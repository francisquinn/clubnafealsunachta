import { verifyEmailChangeToken } from './auth';
import { sendEmailChangedNotice } from './emailChangeEmail';
import { supabaseAdmin } from './supabase';

export type EmailChangeResult = 'success' | 'invalid' | 'taken' | 'error';

// #219: opened from the link sent to the new address. The update is guarded
// on the old address still being current, so a link only works once and
// stops working if the email changed some other way in the meantime. It's
// also guarded on the link being the latest one asked for: each request
// stamps email_change_sent_at just before the link is made, so an older
// link's issue time is earlier than the stamp. Without this, changing the
// email back to an old address would revive links sent from it.
export async function confirmEmailChange(token: string | null): Promise<EmailChangeResult> {
  const payload = token ? verifyEmailChangeToken(token) : null;
  if (!payload) return 'invalid';
  if (!supabaseAdmin) return 'error';

  const { data, error } = await supabaseAdmin
    .from('members')
    // Opening the link proves the member reads the new inbox.
    .update({ email: payload.newEmail, email_verified_at: new Date().toISOString() })
    .eq('id', payload.memberId)
    .eq('email', payload.oldEmail)
    // iat is in whole seconds, the stamp in milliseconds.
    .lt('email_change_sent_at', new Date((payload.issuedAt + 1) * 1000).toISOString())
    .select('id');

  if (error) {
    // Someone signed up with (or switched to) the address after the link was sent.
    if (error.code === '23505') return 'taken';
    console.error('Failed to change member email:', error.message);
    return 'error';
  }
  if (!data || data.length === 0) return 'invalid';

  try {
    await sendEmailChangedNotice(payload.oldEmail, payload.newEmail);
  } catch (err) {
    console.error('Failed to send email changed notice', err);
  }
  return 'success';
}
