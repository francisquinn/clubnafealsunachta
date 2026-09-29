// Shared by PostForm (client-side check, for a friendlier first error) and
// actions/posts.ts (the real gate). 5MB mirrors the avatar cap and stays
// under the 7MB action body limit in astro.config.mjs; 1600px wide is 2x
// the post column.
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const COVER_RESIZE_WIDTH = 1600;
