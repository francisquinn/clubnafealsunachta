// Library order (#131): alphabetical by title, case-insensitive, ignoring a
// leading "the"/"a"/"an" so "The Power of Now" files under P like in a
// bookshop. Slug breaks ties so the order is stable between builds.
const LEADING_ARTICLE = /^(the|an|a)\s+/i;

function sortKey(title: string): string {
  const trimmed = title.trim();
  const withoutArticle = trimmed.replace(LEADING_ARTICLE, '');
  return (withoutArticle || trimmed).toLowerCase();
}

export function sortBooksByTitle<T extends { id: string; data: { title: string } }>(books: T[]): T[] {
  return [...books].sort(
    (a, b) =>
      sortKey(a.data.title).localeCompare(sortKey(b.data.title), 'en', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
  );
}
