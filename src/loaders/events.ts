import type { Loader } from 'astro/loaders';
import { supabaseAdmin } from '../lib/supabase';
import { shouldSkipContentFetch } from './skipFetch';
import { unwrapRelation } from '../lib/supabaseRelations';
import { getAllChapters } from '../lib/chapters';
import { isRsvpStatus, type RsvpCounts } from '../lib/rsvpTypes';

export function eventsLoader(): Loader {
  return {
    name: 'events',
    load: async ({ store }) => {
      if (shouldSkipContentFetch()) {
        store.clear();
        return;
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
      }

      store.clear();

      const [eventsResult, chapters, rsvpsResult] = await Promise.all([
        supabaseAdmin
          .from('events')
          .select('*, venues(name, url), members!events_created_by_fkey(id, username, full_name, display_full_name, avatar_url)')
          .order('date', { ascending: true }),
        getAllChapters(),
        supabaseAdmin.from('rsvps').select('event_id, status'),
      ]);

      if (eventsResult.error) {
        throw new Error(`Failed to fetch events from Supabase: ${eventsResult.error.message}`);
      }

      // #27: build-time aggregate RSVP counts, baked into each event page so
      // a no-JS visitor (and the initial paint) still sees "12 going, 3
      // maybe". Tolerated rather than fatal when the rsvps table isn't
      // deployed yet — a migration-pending build shouldn't take the whole
      // site down, and the client-side island refreshes live counts once the
      // table exists.
      const rsvpCountsByEvent = new Map<number, RsvpCounts>();
      if (rsvpsResult.error) {
        console.error(`Failed to fetch RSVP counts from Supabase: ${rsvpsResult.error.message}`);
      } else {
        for (const row of rsvpsResult.data ?? []) {
          if (!isRsvpStatus(row.status)) continue;
          const counts = rsvpCountsByEvent.get(row.event_id) ?? { going: 0, maybe: 0, not_going: 0 };
          counts[row.status] += 1;
          rsvpCountsByEvent.set(row.event_id, counts);
        }
      }

      const chaptersMap = new Map(chapters.map((c) => [c.id, c]));

      for (const event of eventsResult.data || []) {
        const venue = unwrapRelation(event.venues);
        // #39: events.chapter_id is the single source of truth for "which chapter
        // is this event under" — set from the venue's own chapter for in-person
        // events and from an explicit form field for online ones (see
        // resolveEventChapterId in src/actions/events.ts). No need to derive it
        // from the venue relation separately. #177: every event has one
        // (online events belong to the Online chapter, events.chapter_id is NOT
        // NULL).
        const location = chaptersMap.get(event.chapter_id);
        const creator = unwrapRelation(event.members);

        if (!location) {
          console.error(`Skipping event "${event.slug}": no matching chapter for chapter_id ${event.chapter_id}`);
          continue;
        }
        if (!creator) {
          console.error(`Skipping event "${event.slug}": no matching member for created_by ${event.created_by}`);
          continue;
        }

        store.set({
          id: event.id.toString(),
          data: {
            name: event.name,
            date: new Date(event.date),
            endDate: new Date(event.end_date),
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
            meetPoint: event.meet_point,
            creator,
            rsvpCounts: rsvpCountsByEvent.get(event.id) ?? { going: 0, maybe: 0, not_going: 0 },
            tags: event.tags ?? [],
          },
        });
      }
    },
  };
}
