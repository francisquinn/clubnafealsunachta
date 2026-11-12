import { defineAction, ActionError } from 'astro:actions';
import { sendVerificationEmail } from '../lib/verificationEmail';
import { escapeLikePattern } from '../lib/username';
import { supabaseAdmin } from '../lib/supabase';

// Same timing guard as requestPasswordReset: a request that sends an email
// can't be told apart from one that doesn't.
const MIN_REQUEST_MS = 1500;

// One new link per member per cooldown, so the form can't be used to flood
// someone's inbox.
export const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

// Unconfirmed accounts are deleted about 30 days after signup (see
// delete_stale_unverified_members), and a resend never extends that past 33
// days. Past 30, a new link would outlive its account, so none is sent.
export const UNVERIFIED_ACCOUNT_MS = 30 * 24 * 60 * 60 * 1000;

const SITE_ORIGIN = 'https://clubnafealsunachta.com';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Takes an email or username (the login form passes whatever was typed) and
// always resolves { success: true }, so it can't be used to probe which
// accounts exist or are unverified.
export const resendVerification = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const origin = import.meta.env.PROD ? (context.site?.origin ?? SITE_ORIGIN) : context.url.origin;

    const identifier = (formData.get('identifier') as string | null)?.trim() ?? '';
    if (!identifier) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter your email or username' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const startedAt = Date.now();

    const { data: member } = identifier.includes('@')
      ? await supabaseAdmin.from('members').select('id, email, email_verified_at, created_at').eq('email', identifier.toLowerCase()).maybeSingle()
      : await supabaseAdmin.from('members').select('id, email, email_verified_at, created_at').ilike('username', escapeLikePattern(identifier)).maybeSingle();

    const isExpiring = !!member && Date.now() - new Date(member.created_at).getTime() > UNVERIFIED_ACCOUNT_MS;
    if (member && !member.email_verified_at && !isExpiring) {
      // Claiming the slot with a conditional update keeps two requests in
      // the same window from both sending.
      const now = new Date();
      const cutoff = new Date(now.getTime() - RESEND_COOLDOWN_MS).toISOString();
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('members')
        .update({ verification_sent_at: now.toISOString() })
        .eq('id', member.id)
        .or(`verification_sent_at.is.null,verification_sent_at.lt.${cutoff}`)
        .select('id');

      if (claimError) {
        console.error('Failed to claim verification resend slot:', claimError.message);
      } else if (claimed && claimed.length > 0) {
        try {
          await sendVerificationEmail(member.email, origin);
        } catch (err) {
          console.error('Failed to resend verification email', err);
        }
      }
    }

    await sleep(Math.max(0, MIN_REQUEST_MS - (Date.now() - startedAt)));

    return { success: true };
  },
});
