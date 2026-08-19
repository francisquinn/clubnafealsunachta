import type { Loader } from 'astro/loaders';
import { supabaseAdmin } from '../lib/supabase';
import { unwrapRelation } from '../lib/supabaseRelations';

export function eventsLoader(): Loader {
  return {
    name: 'events',
    load: async ({ store }) => {
      if (!supabaseAdmin) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
      }

      store.clear();

      const [eventsResult, clubsResult] = await Promise.all([
        supabaseAdmin
          .from('events')
          .select('*, venues(name, url, club_id), members(username, full_name, display_full_name)')
          .order('date', { ascending: true }),
        supabaseAdmin
          .from('clubs')
          .select('id, name'),
      ]);

      if (eventsResult.error) {
        throw new Error(`Failed to fetch events from Supabase: ${eventsResult.error.message}`);
      }

      if (clubsResult.error) {
        throw new Error(`Failed to fetch clubs from Supabase: ${clubsResult.error.message}`);
      }

      const clubsMap = new Map(clubsResult.data?.map((c) => [c.id, c]) ?? []);

      for (const event of eventsResult.data || []) {
        const venue = unwrapRelation(event.venues);
        const location = venue?.club_id ? clubsMap.get(venue.club_id) ?? null : null;
        const creator = unwrapRelation(event.members);

        if (!creator) {
          console.error(`Skipping event "${event.slug}": no matching member for created_by ${event.created_by}`);
          continue;
        }

        store.set({
          id: event.id.toString(),
          data: {
            name: event.name,
            date: new Date(event.date),
            location,
            isOnline: event.is_online,
            venue: venue ? { name: venue.name, url: venue.url } : null,
            slug: event.slug,
            description: event.description,
            summary: event.summary,
            social: {
              instagram: event.instagram,
              facebook: event.facebook,
              meetup: event.meetup,
            },
            meetingUrl: event.meeting_url,
            creator,
          },
        });
      }
    },
  };
}
