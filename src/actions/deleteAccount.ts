import { defineAction, ActionError } from 'astro:actions';
import { verifySession, verifyPassword } from '../lib/auth';
import { supabaseAdmin } from '../lib/supabase';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

const AVATARS_BUCKET = 'avatars';

// #210: a member deletes their own account, confirmed with their password.
// Deleting the members row cascades to chapter memberships, chapter admin
// rights and RSVPs; their posts and events stay up with no author, shown as
// "Former member" (author_id/created_by are ON DELETE SET NULL).
export const deleteAccount = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = await verifySession(token);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const password = formData.get('password') as string;
    if (!password) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Enter your password to delete your account' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('password_hash, is_admin, avatar_url')
      .eq('id', payload.memberId)
      .single();

    if (!member) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const valid = await verifyPassword(password, member.password_hash);
    if (!valid) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Password is incorrect' });
    }

    // Without another super admin nobody could manage the site or grant
    // admin rights again.
    if (member.is_admin) {
      const { count, error } = await supabaseAdmin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('is_admin', true)
        .neq('id', payload.memberId);
      if (error) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete account' });
      }
      if (!count) {
        throw new ActionError({
          code: 'FORBIDDEN',
          message: "You're the only site admin. Make someone else an admin before deleting your account.",
        });
      }
    }

    // Posts and events bake the author into static pages, so only those
    // need a rebuild to show "Former member".
    const [posts, events] = await Promise.all([
      supabaseAdmin.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', payload.memberId),
      supabaseAdmin.from('events').select('id', { count: 'exact', head: true }).eq('created_by', payload.memberId),
    ]);
    // A failed count rebuilds anyway rather than leaving a stale author up.
    const authoredContent = Boolean(posts.error || events.error || posts.count || events.count);

    // The photo goes first: if it can't be removed, nothing is deleted and
    // the member can retry, rather than the account going while the photo
    // stays public.
    if (member.avatar_url) {
      const { error: removeError } = await supabaseAdmin.storage.from(AVATARS_BUCKET).remove([payload.memberId]);
      if (removeError) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: "We couldn't delete your photo, so nothing was deleted. Please try again.",
        });
      }
    }

    // Guarding on the hash means a password changed elsewhere in the
    // meantime stops the delete.
    const { data: deleted, error } = await supabaseAdmin
      .from('members')
      .delete()
      .eq('id', payload.memberId)
      .eq('password_hash', member.password_hash)
      .select('id');

    if (error || !deleted || deleted.length === 0) {
      // The photo is already gone, so stop the account pointing at it.
      if (member.avatar_url) {
        await supabaseAdmin.from('members').update({ avatar_url: null }).eq('id', payload.memberId);
      }
      if (error) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete account' });
      }
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Your password was just changed elsewhere. Log in again and retry.',
      });
    }

    // Awaited: in an SSR function an un-awaited hook may never reach Netlify.
    if (authoredContent) await triggerNetlifyBuild();

    context.cookies.delete('session', { path: '/' });
    context.cookies.delete('cnf_logged_in', { path: '/' });
    context.cookies.delete('cnf_avatar_hint', { path: '/' });

    return { success: true };
  },
});
