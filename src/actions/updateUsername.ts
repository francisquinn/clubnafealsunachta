import { defineAction, ActionError } from 'astro:actions';
import { verifySessionToken } from '../lib/auth';
import { validateUsername, validateFullName } from '../utils/validation';
import { escapeLikePattern } from '../lib/username';
import { supabaseAdmin } from '../lib/supabase';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

export const updateUsername = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const username = (formData.get('username') as string)?.trim() ?? '';
    const fullName = (formData.get('full_name') as string)?.trim() ?? '';
    const displayFullName = formData.get('display_full_name') === 'true';

    if (!username) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Username is required' });
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      throw new ActionError({ code: 'BAD_REQUEST', message: usernameError });
    }

    const fullNameError = validateFullName(fullName);
    if (fullNameError) {
      throw new ActionError({ code: 'BAD_REQUEST', message: fullNameError });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data: existingUsername } = await supabaseAdmin
      .from('members')
      .select('id')
      .ilike('username', escapeLikePattern(username))
      .neq('id', payload.memberId)
      .single();

    if (existingUsername) {
      throw new ActionError({ code: 'CONFLICT', message: 'That username is already taken' });
    }

    const { error } = await supabaseAdmin
      .from('members')
      .update({ username, full_name: fullName || null, display_full_name: displayFullName })
      .eq('id', payload.memberId);

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update info' });
    }

    triggerNetlifyBuild();

    return { success: true, username, full_name: fullName || null, display_full_name: displayFullName };
  },
});
