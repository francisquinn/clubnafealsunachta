// Shared by actions/books.ts (the real gate). 5MB mirrors the post cover and
// avatar caps and stays under the 7MB action body limit in astro.config.mjs;
// 800px wide is 2x the widest library card.
export const MAX_BOOK_COVER_BYTES = 5 * 1024 * 1024;
export const BOOK_COVER_RESIZE_WIDTH = 800;
