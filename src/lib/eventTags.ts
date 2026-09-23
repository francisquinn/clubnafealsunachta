// #92: the fixed tag vocabulary for events. Admins pick from this list
// rather than typing free text, so duplicates ("ethic"/"ethics") can't creep
// in. Themes are fitted to what CNF actually discusses, not textbook branches
// of philosophy. The slug is what's stored in `events.tags`; the label is
// what's shown, so a tag can be renamed without touching the data. Kept in
// alphabetical order, which is the order tags are picked from and shown in.
export const EVENT_TAGS = [
  { slug: "art-culture", label: "art & culture" },
  { slug: "ethics", label: "ethics" },
  { slug: "knowledge-truth", label: "knowledge & truth" },
  { slug: "meaning-mortality", label: "meaning & mortality" },
  { slug: "mind-reality", label: "mind & reality" },
  { slug: "relationships", label: "relationships" },
  { slug: "religion-spirituality", label: "religion & spirituality" },
  { slug: "self-identity", label: "self & identity" },
  { slug: "society-politics", label: "society & politics" },
  { slug: "technology", label: "technology" },
] as const;

export type EventTagSlug = (typeof EVENT_TAGS)[number]["slug"];

// One tag, or two if the event really spans both.
export const MIN_TAGS = 1;
export const MAX_TAGS = 2;

const LABELS = new Map<string, string>(EVENT_TAGS.map((t) => [t.slug, t.label]));

export function getTagLabel(slug: string): string | undefined {
  return LABELS.get(slug);
}

// Keeps only known tags, without repeats, in the list's own order, capped
// at MAX_TAGS.
export function normalizeTags(tags: readonly string[]): EventTagSlug[] {
  return EVENT_TAGS.map((t) => t.slug)
    .filter((slug) => tags.includes(slug))
    .slice(0, MAX_TAGS);
}
