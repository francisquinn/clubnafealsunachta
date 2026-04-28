import type { Loader } from 'astro/loaders';
import { supabase } from '../lib/supabase';

interface SupabaseEvent {
  id: number;
  name: string;
  date: string;
  venue_id: number | null;
  venues: {
    name: string;
    url: string | null;
    city: string;
  } | null;
  slug: string;
  instagram: string | null;
  facebook: string | null;
  meetup: string | null;
  description: string | null;
  summary: string | null;
  created_at: string | null;
}

export function eventsLoader(): Loader {
  return {
    name: 'events',
    load: async ({ store }) => {
      if (!supabase) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_API_KEY');
      }

      store.clear();

      const { data, error } = await supabase
        .from('events')
        .select('*, venues(name, url, city)')
        .order('date', { ascending: true })
        .returns<SupabaseEvent[]>();

      if (error) {
        throw new Error(`Failed to fetch events from Supabase: ${error.message}`);
      }

      for (const event of data || []) {
        store.set({
          id: event.id.toString(),
          data: {
            name: event.name,
            date: new Date(event.date),
            city: event.venues?.city ?? null,
            location: {
              name: event.venues?.name ?? null,
              url: event.venues?.url ?? null,
            },
            slug: event.slug,
            description: event.description,
            summary: event.summary,
            social: {
              instagram: event.instagram,
              facebook: event.facebook,
              meetup: event.meetup,
            },
          },
        });
      }
    },
  };
}
