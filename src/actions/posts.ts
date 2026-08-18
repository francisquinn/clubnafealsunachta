import { defineAction, ActionError } from 'astro:actions';
import { supabaseAdmin } from '../lib/supabase';
import { sendMailchimpPostEmail } from '../lib/mailchimp';
import { requireAdmin } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

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
    const slug = formData.get('slug') as string;
    const date = formData.get('date') as string;
    const body = formData.get('body') as string;

    if (!title || !slug || !date || !body) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    const { error } = await supabaseAdmin
      .from('posts')
      .insert([{ title, slug, author_id: admin.memberId, date, body }]);

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

    const { data: updated, error } = await supabaseAdmin
      .from('posts')
      .update({ title, date, body })
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
