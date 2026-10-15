// CI-only escape hatch so `astro check` can sync the content collections
// without Supabase credentials. Never set this on Netlify: the site would
// build with empty collections, so a Netlify build with the flag fails here.
export function shouldSkipContentFetch(): boolean {
  if (process.env.SKIP_CONTENT_FETCH !== '1') return false;
  if (process.env.NETLIFY) {
    throw new Error('SKIP_CONTENT_FETCH is set on Netlify; remove it, or the site builds with no content');
  }
  return true;
}
