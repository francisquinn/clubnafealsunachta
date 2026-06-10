import { defineAction, ActionError } from 'astro:actions';
import { supabaseAdmin } from '../lib/supabase';
import { hashPassword, verifySessionToken } from '../lib/auth';

export const createUser = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload?.isAdmin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const email = (formData.get('email') as string)?.toLowerCase() ?? '';
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (!email || !password || !confirmPassword) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Passwords do not match' });
    }

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      throw new ActionError({ code: 'CONFLICT', message: 'An account with that email already exists' });
    }

    const password_hash = await hashPassword(password);
    const is_admin = formData.get('is_admin') === 'true';

    const { error } = await supabaseAdmin
      .from('users')
      .insert({ email, password_hash, is_admin });

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create account' });
    }

    return { success: true };
  }
});
