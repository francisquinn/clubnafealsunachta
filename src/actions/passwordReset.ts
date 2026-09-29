import { defineAction, ActionError } from 'astro:actions';
import { hashPassword, verifyPasswordResetToken, isPasswordResetTokenCurrent } from '../lib/auth';
import { sendPasswordResetEmail } from '../lib/passwordResetEmail';
import { validatePassword } from '../utils/validation';
import { isValidEmail } from '../utils/script';
import { supabaseAdmin } from '../lib/supabase';

// A reset request always takes at least this long, so a request that sends an
// email (slow SMTP round trip) can't be told apart by timing from one that
// doesn't (unknown or unverified email, which would otherwise return at once).
const MIN_REQUEST_MS = 1500;

// Fallback if the Astro `site` config is ever missing; keep in sync with it.
const SITE_ORIGIN = 'https://clubnafealsunachta.com';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Always resolves { success: true } for a well-formed email, whether or not a
// member exists (or is verified), so the form can't be used to probe which
// addresses have accounts. Unverified members are skipped: a reset link
// landing in their inbox would otherwise be a way around email confirmation.
export const requestPasswordReset = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    // The reset link carries an account-takeover token, so in production it
    // must point at the configured site, never at whatever Host header the
    // request arrived with (a spoofed one would send the token to the
    // attacker's domain). Dev has no fixed public origin, so use the request's.
    const origin = import.meta.env.PROD ? (context.site?.origin ?? SITE_ORIGIN) : context.url.origin;

    const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
    if (!isValidEmail(email)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a valid email address' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const startedAt = Date.now();

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, password_hash, email_verified_at')
      .eq('email', email)
      .single();

    if (member?.email_verified_at) {
      try {
        await sendPasswordResetEmail(email, member.id, member.password_hash, origin);
      } catch (err) {
        console.error('Failed to send password reset email', err);
      }
    }

    await sleep(Math.max(0, MIN_REQUEST_MS - (Date.now() - startedAt)));

    return { success: true };
  },
});

export const resetPassword = defineAction({
  accept: 'form',
  handler: async (formData) => {
    const token = formData.get('token') as string | null;
    const newPassword = formData.get('new_password') as string | null;
    const confirmPassword = formData.get('confirm_password') as string | null;

    if (!token || !newPassword || !confirmPassword) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'All fields are required' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      throw new ActionError({ code: 'BAD_REQUEST', message: passwordError });
    }

    if (newPassword !== confirmPassword) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Passwords do not match' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const invalidLink = new ActionError({
      code: 'UNAUTHORIZED',
      message: 'This reset link is invalid or has expired. Please request a new one.',
    });

    const payload = verifyPasswordResetToken(token);
    if (!payload) throw invalidLink;

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('password_hash')
      .eq('id', payload.memberId)
      .single();

    if (!member || !isPasswordResetTokenCurrent(payload.fp, member.password_hash)) {
      throw invalidLink;
    }

    const password_hash = await hashPassword(newPassword);

    // Guarding the update on the old hash closes the race where two requests
    // with the same link both pass the check above: only the first matches.
    // sessions_valid_after logs out every session issued before this reset -
    // that's the point of resetting a password you may have lost control of.
    const { data: updated, error } = await supabaseAdmin
      .from('members')
      .update({ password_hash, sessions_valid_after: new Date().toISOString() })
      .eq('id', payload.memberId)
      .eq('password_hash', member.password_hash)
      .select('id');

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update password' });
    }
    if (!updated || updated.length === 0) throw invalidLink;

    return { success: true };
  },
});
