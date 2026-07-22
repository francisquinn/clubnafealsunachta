import { defineAction, ActionError } from 'astro:actions';
import { verifySessionToken } from '../lib/auth';
import { createAccount } from '../lib/memberAccount';

export const createMember = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload?.isAdmin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const isAdmin = formData.get('is_admin') === 'true';
    await createAccount(formData, isAdmin, context.url.origin, true);
    return { success: true };
  },
});
