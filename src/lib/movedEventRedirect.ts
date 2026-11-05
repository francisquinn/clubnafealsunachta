import { getCollection } from "astro:content";

// #195: an event's URL is /<chapter>/events/<slug>, so moving it to another
// chapter orphans the old URL. Event slugs are globally unique (events.slug is
// UNIQUE), so the slug alone identifies the event and we can send a stale
// chapter prefix to the current one. Matches the page and its .ics file.
const EVENT_PATH = /^\/([^/]+)\/events\/([^/]+?)(\.ics)?\/?$/;

// Slug -> current chapter slug, built once per server process from the
// collection (which is fixed per build) so repeated 404s skip the linear scan.
let chapterBySlug: Promise<Map<string, string>> | null = null;

function getChapterBySlug(): Promise<Map<string, string>> {
  chapterBySlug ??= getCollection("event")
    .then((events) => new Map(events.map((e) => [e.data.slug, e.data.location.slug])))
    .catch((error) => {
      // Don't cache a failure: the next request retries.
      chapterBySlug = null;
      throw error;
    });
  return chapterBySlug;
}

export async function findMovedEventPath(pathname: string): Promise<string | null> {
  const match = EVENT_PATH.exec(pathname);
  if (!match) return null;
  const [, chapterSlug, eventSlug, ics = ""] = match;

  const currentChapter = (await getChapterBySlug()).get(eventSlug!);
  if (!currentChapter || currentChapter === chapterSlug) return null;

  return `/${currentChapter}/events/${eventSlug}${ics}`;
}
