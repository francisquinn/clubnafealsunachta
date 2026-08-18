// Fires the Netlify build hook to trigger a rebuild after content that's
// baked into static pages (posts, events, member display names) changes.
// Deliberately fire-and-forget: callers should not await this on a
// user-facing response path, since a slow/hanging build-hook endpoint has
// nothing to do with whether the caller's own action succeeded.
export function triggerNetlifyBuild(): void {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) return;

  fetch(buildHookUrl, { method: 'POST' }).catch((e) =>
    console.error('Netlify build hook failed:', e)
  );
}
