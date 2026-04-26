import { defineAction } from 'astro:actions';
import { supabase } from '../lib/supabase';
import { CITY } from '../types/types';

const createEvent = defineAction({
  accept: 'form',
  handler: async (formData) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const input = {
      name: formData.get('name') as string,
      date: formData.get('date') as string,
      city: (formData.get('city') as string) || CITY.TRIESTE,
      location_name: formData.get('location_name') as string || undefined,
      location_url: formData.get('location_url') as string || undefined,
      slug: formData.get('slug') as string,
      instagram: formData.get('instagram') as string || undefined,
      facebook: formData.get('facebook') as string || undefined,
      meetup: formData.get('meetup') as string || undefined,
      description: formData.get('description') as string || undefined,
      summary: formData.get('summary') as string || undefined,
    };

    if (!input.name || !input.date || !input.slug) {
      throw new Error('Missing required fields');
    }

    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      throw new Error('Slug must contain only lowercase letters, numbers and hyphens');
    }

    const { error } = await supabase
      .from('events')
      .insert([input])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
    if (buildHookUrl) {
      await fetch(buildHookUrl, { method: 'POST' }).catch((e) =>
        console.error('Netlify build hook failed:', e)
      );
    }

    return { success: true };
  }
});

export const server = {
  createEvent,
};
