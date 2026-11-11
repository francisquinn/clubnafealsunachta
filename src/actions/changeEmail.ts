import { defineAction, ActionError } from 'astro:actions';
import { verifySession, verifyPassword } from '../lib/auth';
import { sendEmailChangeConfirmation } from '../lib/emailChangeEmail';
import { isValidEmail } from '../utils/script';
import { supabaseAdmin } from '../lib/supabase';

// One link per member per cooldown, so the form can't be used to flood
// someone's inbox from the club's address (as resendVerification).
export const EMAIL_CHANGE_COOLDOWN_MS = 5 * 60 * 1000;

// Fallback if the Astro `site` config is ever missing; keep in sync with it.
const SITE_ORIGIN = 'https://clubnafealsunachta.com';

// #219: sends a confirmation link to the new address. Nothing changes until
// that link is opened (see pages/confirm-email-change.astro).
export const requestEmailChange = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    // The link switches the account's email, so in production it must point
    // at the configured site, never at a spoofed Host header.
    const origin = import.meta.env.PROD ? (context.site?.origin ?? SITE_ORIGIN) : context.url.origin;

    const payload = await verifySession(context.cookies.get('session')?.value);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'You need to be logged in' });
    }

    const newEmail = (formData.get('new_email') as string | null)?.trim().toLowerCase() ?? '';
    const password = (formData.get('password') as string | null) ?? '';

    if (!isValidEmail(newEmail)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a valid email address' });
    }
    if (!password) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter your password' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('email, password_hash')
      .eq('id', payload.memberId)
      .single();

    if (!member || !(await verifyPassword(password, member.password_hash))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'That password is incorrect' });
    }

    if (newEmail === member.email) {
      throw new ActionError({ code: 'BAD_REQUEST', message: "That's already your email" });
    }

    // Signup already says when an address is taken, so saying it here (behind
    // a password) reveals nothing new. The confirm page checks again, since
    // someone could sign up with it before the link is opened.
    const { data: taken } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();

    if (taken) {
      throw new ActionError({ code: 'CONFLICT', message: 'That email is already used by another account' });
    }

    // Claiming the slot with a conditional update keeps two requests in the
    // same window from both sending. The member has just given their
    // password, so saying they're rate-limited reveals nothing.
    const now = new Date();
    const cutoff = new Date(now.getTime() - EMAIL_CHANGE_COOLDOWN_MS).toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('members')
      .update({ email_change_sent_at: now.toISOString() })
      .eq('id', payload.memberId)
      .or(`email_change_sent_at.is.null,email_change_sent_at.lt.${cutoff}`)
      .select('id');

    if (claimError) {
      console.error('Failed to claim email change slot:', claimError.message);
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: "We couldn't send the confirmation email. Please try again." });
    }
    if (!claimed || claimed.length === 0) {
      throw new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: "You've just asked for a link. Please wait a few minutes before asking again.",
      });
    }

    try {
      await sendEmailChangeConfirmation(payload.memberId, member.email, newEmail, origin);
    } catch (err) {
      console.error('Failed to send email change confirmation', err);
      // Nothing went out, so free the slot for an immediate retry.
      await supabaseAdmin.from('members').update({ email_change_sent_at: null }).eq('id', payload.memberId);
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: "We couldn't send the confirmation email. Please try again." });
    }

    return { success: true };
  },
});
