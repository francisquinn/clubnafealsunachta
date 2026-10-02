// Fires the Netlify build hook to trigger a rebuild after content that's
// baked into static pages (posts, events, member display names) changes.
// Fire-and-forget by default: callers should not await this on a
// user-facing response path, since a slow/hanging build-hook endpoint has
// nothing to do with whether the caller's own action succeeded.
//
// It returns the request's promise (never rejects) for callers that must
// await it: in an SSR function the in-flight fetch is cancelled once the
// response returns, so an un-awaited hook may never reach Netlify (#127).
export function triggerNetlifyBuild(): Promise<void> {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) return Promise.resolve();

  return fetch(buildHookUrl, { method: 'POST', signal: AbortSignal.timeout(5000) })
    .then((response) => {
      if (!response.ok) {
        console.error(`Netlify build hook failed with HTTP ${response.status}`);
      }
    })
    .catch((e) => console.error('Netlify build hook failed:', e));
}
