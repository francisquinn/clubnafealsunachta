import { defineAction } from 'astro:actions';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { sendMailchimpEmail } from '../lib/mailchimp';
import { CITY } from '../types/types';

const createEvent = defineAction({
  accept: 'form',
  handler: async (formData) => {
    if (!supabaseAdmin) {
      throw new Error('Supabase not configured');
    }

    const name = formData.get('name') as string;
    const date = formData.get('date') as string;
    const slug = formData.get('slug') as string;
    const city = (formData.get('city') as string) || CITY.TRIESTE;
    const location_name = (formData.get('location_name') as string) || null;
    const location_url = (formData.get('location_url') as string) || null;

    if (!name || !date || !slug) {
      throw new Error('Missing required fields');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('Slug must contain only lowercase letters, numbers and hyphens');
    }

    let venue_id: number | null = null;
    if (location_name) {
      const { data: venue, error: venueError } = await supabaseAdmin
        .from('venues')
        .upsert({ name: location_name, url: location_url, city }, { onConflict: 'name,city' })
        .select('id')
        .single();

      if (venueError) throw new Error(venueError.message);
      venue_id = venue.id;
    }

    const { error } = await supabaseAdmin
      .from('events')
      .insert([{
        name,
        date,
        slug,
        venue_id,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
      }])
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

    await sendMailchimpEmail({
      name,
      date,
      slug,
      venue_name: location_name,
      venue_url: location_url,
    }).catch((e) => console.error('Mailchimp draft creation failed:', e));

    return { success: true };
  }
});

const getVenues = defineAction({
  handler: async () => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
      .from('venues')
      .select('id, name, url, city')
      .order('name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }
});

export const server = {
  createEvent,
  getVenues,
};
