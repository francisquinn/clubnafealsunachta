import { defineAction, ActionError } from 'astro:actions';
import { supabaseAdmin } from '../lib/supabase';
import { sendMailchimpPostEmail } from '../lib/mailchimp';
import { requireAdmin } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';
import { resolveUniqueSlug } from '../lib/slugDedup';
import { uploadImageIfPresent } from '../lib/storageUpload';
import { MAX_COVER_BYTES, COVER_RESIZE_WIDTH } from '../lib/postCover';

const COVERS_BUCKET = 'post-covers';
const COVER_LIMITS = { label: 'Cover image', maxBytes: MAX_COVER_BYTES, resizeWidth: COVER_RESIZE_WIDTH };

export const createPost = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const title = formData.get('title') as string;
    const rawSlug = formData.get('slug') as string;
    const date = formData.get('date') as string;
    const body = formData.get('body') as string;

    if (!title || !rawSlug || !date || !body) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    if (!/^[a-z0-9-]+$/.test(rawSlug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    const slug = await resolveUniqueSlug(supabaseAdmin, 'posts', rawSlug);
    const cover_image_url = await uploadImageIfPresent(formData, 'cover_image', COVERS_BUCKET, slug, COVER_LIMITS);

    const { error } = await supabaseAdmin
      .from('posts')
      .insert([{ title, slug, author_id: admin.memberId, date, body, cover_image_url }]);

    if (error) {
      if (error.code === '23505') {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'A post with this slug already exists' });
      }
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    triggerNetlifyBuild();

    await sendMailchimpPostEmail({ title, slug, body }).catch((e) =>
      console.error('Mailchimp post email failed:', e)
    );

    return { success: true };
  }
});

export const updatePost = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    if (!(await requireAdmin(context.request))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const slug = formData.get('slug') as string;
    const title = formData.get('title') as string;
    const date = formData.get('date') as string;
    const body = formData.get('body') as string;

    if (!title || !slug || !date || !body) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    // No new file chosen leaves cover_image_url out of the update entirely,
    // so the existing cover survives untouched.
    const newCoverUrl = await uploadImageIfPresent(formData, 'cover_image', COVERS_BUCKET, slug, COVER_LIMITS);

    const { data: updated, error } = await supabaseAdmin
      .from('posts')
      .update({
        title,
        date,
        body,
        ...(newCoverUrl ? { cover_image_url: newCoverUrl } : {}),
      })
      .eq('slug', slug)
      .select('slug')
      .single();

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    if (!updated) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Post not found' });
    }

    triggerNetlifyBuild();

    return { success: true };
  }
});
