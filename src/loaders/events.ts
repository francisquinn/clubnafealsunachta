import type { Loader } from 'astro/loaders';
import { supabase } from '../lib/supabase';

export function eventsLoader(): Loader {
  return {
    name: 'events',
    load: async ({ store }) => {
      if (!supabase) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_API_KEY');
      }

      store.clear();

      const [eventsResult, locationsResult] = await Promise.all([
        supabase
          .from('events')
          .select('*, venues(name, url)')
          .order('date', { ascending: true }),
        supabase
          .from('locations')
          .select('id, name'),
      ]);

      if (eventsResult.error) {
        throw new Error(`Failed to fetch events from Supabase: ${eventsResult.error.message}`);
      }

      if (locationsResult.error) {
        throw new Error(`Failed to fetch locations from Supabase: ${locationsResult.error.message}`);
      }

      const locationsMap = new Map(locationsResult.data?.map((l) => [l.id, l]) ?? []);

      for (const event of eventsResult.data || []) {
        const venue = Array.isArray(event.venues) ? event.venues[0] ?? null : event.venues ?? null;
        const location = event.location_id ? locationsMap.get(event.location_id) ?? null : null;

        store.set({
          id: event.id.toString(),
          data: {
            name: event.name,
            date: new Date(event.date),
            location,
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
          },
        });
      }
    },
  };
}
