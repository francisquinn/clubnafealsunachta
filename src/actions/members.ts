import { defineAction, ActionError } from 'astro:actions';
import { requireAdmin } from '../lib/auth';
import { createAccount } from '../lib/memberAccount';

export const createMember = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    if (!(await requireAdmin(context.request))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const isAdmin = formData.get('is_admin') === 'true';
    await createAccount(formData, isAdmin, context.url.origin, true);
    return { success: true };
  },
});
