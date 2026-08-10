import { defineAction, ActionError } from 'astro:actions';
import { verifySessionToken, verifyPassword, hashPassword } from '../lib/auth';
import { validatePassword } from '../utils/validation';
import { supabaseAdmin } from '../lib/supabase';

export const changePassword = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const currentPassword = formData.get('current_password') as string;
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
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

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('password_hash')
      .eq('email', payload.email)
      .single();

    if (!member) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const valid = await verifyPassword(currentPassword, member.password_hash);
    if (!valid) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
    }

    const password_hash = await hashPassword(newPassword);

    const { error } = await supabaseAdmin
      .from('members')
      .update({ password_hash })
      .eq('email', payload.email);

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update password' });
    }

    return { success: true };
  },
});
