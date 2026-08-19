import { defineAction, ActionError } from 'astro:actions';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { sendMailchimpEmail } from '../lib/mailchimp';
import { requireAdmin } from '../lib/auth';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

type ResolvedVenue = { id: number; name: string; url: string | null };

// Resolves the venue for a non-online event: an existing venue is looked up
// by id as-is, a "New venue…" submission (name + club, no id yet) is
// upserted. Returns null when the event is online or no venue was picked.
async function resolveVenue(formData: FormData, is_online: boolean): Promise<ResolvedVenue | null> {
  if (is_online) return null;

  const selected_venue_id = formData.get('venue_id')
    ? Number(formData.get('venue_id'))
    : null;
  if (selected_venue_id) {
    const { data: venue, error } = await supabaseAdmin!
      .from('venues')
      .select('id, name, url')
      .eq('id', selected_venue_id)
      .single();

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return venue;
  }

  const club_id = formData.get('club_id') ? Number(formData.get('club_id')) : null;
  const location_name = (formData.get('location_name') as string) || null;
  if (!club_id || !location_name) return null;

  const location_url = (formData.get('location_url') as string) || null;
  const { data: venue, error } = await supabaseAdmin!
    .from('venues')
    .upsert({ name: location_name, url: location_url, club_id }, { onConflict: 'name,club_id' })
    .select('id, name, url')
    .single();

  if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  return venue;
}

export const createEvent = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const admin = await requireAdmin(context.request);
    if (!admin) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const name = formData.get('name') as string;
    const date = formData.get('date') as string;
    const slug = formData.get('slug') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;

    if (!name || !date || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Slug must contain only lowercase letters, numbers and hyphens' });
    }

    const venue = await resolveVenue(formData, is_online);

    const { error } = await supabaseAdmin
      .from('events')
      .insert([{
        name,
        date,
        slug,
        is_online,
        venue_id: venue?.id ?? null,
        created_by: admin.memberId,
        meeting_url,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
      }])
      .select()
      .single();

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    triggerNetlifyBuild();

    await sendMailchimpEmail({
      name,
      date,
      slug,
      meeting_url,
      venue_name: venue?.name ?? null,
      venue_url: venue?.url ?? null,
    }).catch((e) => console.error('Mailchimp draft creation failed:', e));

    return { success: true };
  }
});

export const updateEvent = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    if (!(await requireAdmin(context.request))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const slug = formData.get('slug') as string;
    const name = formData.get('name') as string;
    const date = formData.get('date') as string;
    const is_online = formData.get('is_online') === 'true';
    const meeting_url = (formData.get('meeting_url') as string) || null;

    if (!name || !date || !slug) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'Missing required fields' });
    }

    const venue = await resolveVenue(formData, is_online);

    const { error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        date,
        is_online,
        venue_id: venue?.id ?? null,
        meeting_url,
        instagram: (formData.get('instagram') as string) || null,
        facebook: (formData.get('facebook') as string) || null,
        meetup: (formData.get('meetup') as string) || null,
        description: (formData.get('description') as string) || null,
        summary: (formData.get('summary') as string) || null,
      })
      .eq('slug', slug);

    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }

    triggerNetlifyBuild();

    return { success: true };
  }
});

export const getClubs = defineAction({
  handler: async () => {
    if (!supabase) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('clubs')
      .select('id, name')
      .order('name');

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }
});

export const getVenues = defineAction({
  handler: async (_, context) => {
    if (!(await requireAdmin(context.request))) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabase) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('venues')
      .select('id, name, url, club_id')
      .order('name');

    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }
});
