import { defineAction, ActionError } from 'astro:actions';
import { verifySessionToken, setAvatarHintCookie } from '../lib/auth';
import { supabaseAdmin } from '../lib/supabase';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';
import { transformAvatarUrl, AVATAR_STORED_SIZE } from '../lib/avatarTransform';
import { sniffImageType } from '../lib/imageType';

const AVATARS_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB — covers a typical phone-camera photo; no client compression, so this is a sanity cap, not a quality one (the re-store below normalizes everything to AVATAR_STORED_SIZE regardless of input size)

// #70: a member's own photo, uploaded from /profile/edit. Same upload shape
// as books.ts's uploadCoverIfPresent (upsert, contentType from the file),
// but keyed by member id with no file extension in the storage key — unlike
// a book's slug-keyed cover, a member can re-upload a different image type
// later (jpg replaced by png, say), and an extension-bearing key would leave
// the old file orphaned rather than genuinely overwritten. Supabase Storage
// doesn't need an extension: it serves the object's stored Content-Type
// regardless of the key's spelling.
export const uploadAvatar = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const file = formData.get('avatar');
    if (!(file instanceof File) || file.size === 0) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'No file provided' });
    }

    if (file.size > MAX_AVATAR_BYTES) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Avatar must be 5MB or smaller' });
    }

    // Client-side validation (AccountForm) is a nicer first error message,
    // never the real gate. The server can't trust file.type either — it's
    // just a client-supplied string, freely spoofable by calling the action
    // directly — so this sniffs the actual magic bytes and stores the
    // real detected type, not whatever the request claimed.
    const sniffedType = sniffImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (!sniffedType) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Avatar must be a JPEG, PNG, GIF, or WEBP image' });
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATARS_BUCKET)
      .upload(payload.memberId, file, { upsert: true, contentType: sniffedType });

    if (uploadError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Avatar upload failed: ${uploadError.message}` });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(AVATARS_BUCKET).getPublicUrl(payload.memberId);

    // Re-fetch through Supabase's own render/image transform and store THAT
    // in place of the just-uploaded original — otherwise the full-size file
    // (up to 5MB) sits in Storage forever, even though nothing ever serves
    // it at more than AVATAR_STORED_SIZE (getAvatarDisplayUrl only ever
    // requests small transforms of whatever's stored). Best-effort: a
    // failure here keeps the original in place rather than failing the
    // whole upload — a full-size photo beats none.
    try {
      const resizeResponse = await fetch(transformAvatarUrl(publicUrlData.publicUrl, AVATAR_STORED_SIZE));
      if (resizeResponse.ok) {
        const resizedBlob = await resizeResponse.blob();
        await supabaseAdmin.storage
          .from(AVATARS_BUCKET)
          .upload(payload.memberId, resizedBlob, { upsert: true, contentType: resizedBlob.type || sniffedType });
      }
    } catch (err) {
      console.error('Avatar re-store at reduced size failed (keeping original):', err);
    }

    // username/full_name/display_full_name come back too even though this
    // action doesn't touch them — needed to rebuild the full
    // cnf_avatar_hint cookie below without a second round trip.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('members')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', payload.memberId)
      .select('username, full_name, display_full_name')
      .single();

    if (updateError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save avatar' });
    }

    // avatar_url is baked into the events/posts static content collections
    // (see loaders/events.ts, loaders/posts.ts) same as username/full_name
    // — without this, a new photo would never show up there in production
    // until some unrelated save happened to trigger a rebuild.
    triggerNetlifyBuild();

    // Otherwise AccountMenu's header avatar would show the old photo/letter
    // for one more page load, until its own background /api/me fetch
    // catches up.
    if (updated) {
      setAvatarHintCookie(context.cookies, {
        id: payload.memberId,
        username: updated.username,
        full_name: updated.full_name,
        display_full_name: updated.display_full_name,
        avatar_url: publicUrlData.publicUrl,
      });
    }

    return { success: true, avatar_url: publicUrlData.publicUrl };
  },
});
