import type { Loader } from 'astro/loaders';
import { supabaseAdmin } from '../lib/supabase';
import { unwrapRelation } from '../lib/supabaseRelations';
import { getAllClubs } from '../lib/clubs';

export function eventsLoader(): Loader {
  return {
    name: 'events',
    load: async ({ store }) => {
      if (!supabaseAdmin) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
      }

      store.clear();

      const [eventsResult, clubs] = await Promise.all([
        supabaseAdmin
          .from('events')
          .select('*, venues(name, url), members(username, full_name, display_full_name)')
          .order('date', { ascending: true }),
        getAllClubs(),
      ]);

      if (eventsResult.error) {
        throw new Error(`Failed to fetch events from Supabase: ${eventsResult.error.message}`);
      }

      const clubsMap = new Map(clubs.map((c) => [c.id, c]));

      for (const event of eventsResult.data || []) {
        const venue = unwrapRelation(event.venues);
        // #39: events.club_id is the single source of truth for "which club
        // is this event under" — set from the venue's own club for in-person
        // events and from an explicit form field for online ones (see
        // resolveEventClubId in src/actions/events.ts), null meaning
        // genuinely cross-chapter/global. No need to derive it from the
        // venue relation separately.
        const location = event.club_id ? clubsMap.get(event.club_id) ?? null : null;
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
