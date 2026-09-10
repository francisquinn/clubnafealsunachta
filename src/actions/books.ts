import { defineAction, ActionError } from 'astro:actions';
import { supabaseAdmin } from '../lib/supabase';
import { requireAdmin } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

const COVERS_BUCKET = 'book-covers';

// Uploads a cover image to the book-covers bucket, keyed by the book's slug
// (upsert: a re-upload on edit just overwrites the same object instead of
// leaving the old file orphaned). Returns the public URL, or null if no
// file was actually chosen — an empty file input still shows up in
// FormData, just with size 0.
async function uploadCoverIfPresent(
  formData: FormData,
  slug: string
): Promise<string | null> {
  const file = formData.get('cover_image');
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const { error } = await supabaseAdmin!.storage
    .from(COVERS_BUCKET)
    .upload(slug, file, { upsert: true, contentType: file.type });

  if (error) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Cover upload failed: ${error.message}` });
  }

  const { data } = supabaseAdmin!.storage.from(COVERS_BUCKET).getPublicUrl(slug);
  return data.publicUrl;
}

export const createBook = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    if (!(await requireAdmin(context.request))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const slug = formData.get('slug') as string;
    const goodreads_url = (formData.get('goodreads_url') as string)?.trim() || null;

    if (!title || !author || !slug || !goodreads_url) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    const cover_image_url = await uploadCoverIfPresent(formData, slug);

    const { error } = await supabaseAdmin
      .from('books')
      .insert([{ title, author, slug, cover_image_url, goodreads_url }]);

    if (error) {
      if (error.code === '23505') {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'A book with this slug already exists' });
      }
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    triggerNetlifyBuild();

    return { success: true };
  }
});

export const updateBook = defineAction({
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
    const author = formData.get('author') as string;
    const goodreads_url = (formData.get('goodreads_url') as string)?.trim() || null;

    if (!title || !author || !slug || !goodreads_url) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    // No new file chosen leaves cover_image_url out of the update entirely,
    // so the existing cover survives untouched.
    const newCoverUrl = await uploadCoverIfPresent(formData, slug);

    const { data: updated, error } = await supabaseAdmin
      .from('books')
      .update({
        title,
        author,
        goodreads_url,
        ...(newCoverUrl ? { cover_image_url: newCoverUrl } : {}),
      })
      .eq('slug', slug)
      .select('slug')
      .single();

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    if (!updated) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    triggerNetlifyBuild();

    return { success: true };
  }
});
