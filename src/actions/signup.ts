import { defineAction } from 'astro:actions';
import { createAccount } from '../lib/memberAccount';

export const signup = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    await createAccount(formData, false, context.url.origin);
    return { success: true };
  },
});
