// Lowercase, strips accents, and collapses anything that isn't a-z0-9 into
// single hyphens (no leading/trailing hyphen) — matches the events table's
// slug format constraint (see createEvent/updateEvent).
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
