import { ActionError } from 'astro:actions';
import { supabaseAdmin } from './supabase';
import { hashPassword } from './auth';
import { validateUsername, validatePassword } from '../utils/validation';
import { isValidEmail } from '../utils/script';
import { memberInsertErrorMessage } from './memberErrors';
import { escapeLikePattern } from './username';
import { sendVerificationEmail } from './verificationEmail';

export async function createAccount(formData: FormData, isAdmin: boolean, origin: string, autoVerify = false): Promise<void> {
  if (!supabaseAdmin) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
  }

  const username = (formData.get('username') as string)?.trim() ?? '';
  const email = (formData.get('email') as string)?.toLowerCase().trim() ?? '';
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  if (!username || !email || !password || !confirmPassword) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'All fields are required' });
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    throw new ActionError({ code: 'BAD_REQUEST', message: usernameError });
  }

  if (!isValidEmail(email)) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter a valid email address' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new ActionError({ code: 'BAD_REQUEST', message: passwordError });
  }

  if (password !== confirmPassword) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Passwords do not match' });
  }

  const { data: existingEmail } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('email', email)
    .single();

  if (existingEmail) {
    throw new ActionError({ code: 'CONFLICT', message: 'An account with that email already exists' });
  }

  const { data: existingUsername } = await supabaseAdmin
    .from('members')
    .select('id')
    .ilike('username', escapeLikePattern(username))
    .single();

  if (existingUsername) {
    throw new ActionError({ code: 'CONFLICT', message: 'That username is already taken' });
  }

  const password_hash = await hashPassword(password);

  const { error } = await supabaseAdmin
    .from('members')
    .insert({
      username,
      email,
      password_hash,
      is_admin: isAdmin,
      email_verified_at: autoVerify ? new Date().toISOString() : null,
    });

  if (error) {
    throw new ActionError(memberInsertErrorMessage(error));
  }

  if (!autoVerify) {
    try {
      await sendVerificationEmail(email, origin);
    } catch (err) {
      console.error('Failed to send verification email', err);
    }
  }
}
