// #70 follow-up: avatars only ever render at 32-64px (.cnf-avatar--sm/--lg
// in global.css), but the stored avatar_url points at whatever full-
// resolution file the member uploaded (up to 5MB) - every page rendering
// their avatar was downloading that full file just to shrink it into a
// tiny circle. Supabase Storage can resize on the fly via its render
// endpoint instead: measured against a real 1.77MB upload, the sm/lg sizes
// below came back at ~6.9KB and ~22KB respectively - a ~260x/~82x cut,
// for a one-line URL change and no new dependency (no canvas/EXIF handling
// like a client-side-resize approach would need).
const TRANSFORM_SIZES: Record<"sm" | "lg", number> = {
  sm: 64, // 2x headroom over the largest --sm slot (32px, .cnf-account__toggle)
  lg: 128, // 2x headroom over --lg's 64px slot
};

// The size actually written to Storage, replacing the original upload (see
// actions/avatar.ts) - generous headroom over the 128px max current display
// size for any near-future bigger avatar UI, while still cutting a typical
// multi-MB phone photo down to tens of KB.
export const AVATAR_STORED_SIZE = 400;

const OBJECT_URL_MARKER = "/storage/v1/object/public/";
const RENDER_URL_SEGMENT = "/storage/v1/render/image/public/";

// Every avatar_url in practice comes from uploadAvatar's getPublicUrl call,
// which always has this shape - falls back to the URL untouched otherwise
// (defensive, not expected to trigger).
export function transformAvatarUrl(avatarUrl: string, pixelSize: number): string {
  const markerIndex = avatarUrl.indexOf(OBJECT_URL_MARKER);
  if (markerIndex === -1) return avatarUrl;

  const transformedUrl =
    avatarUrl.slice(0, markerIndex) + RENDER_URL_SEGMENT + avatarUrl.slice(markerIndex + OBJECT_URL_MARKER.length);
  return `${transformedUrl}?width=${pixelSize}&height=${pixelSize}`;
}

// Display-time convenience: picks the pixel size from the Avatar
// component's own size prop instead of the caller needing to know pixels.
export function getAvatarDisplayUrl(avatarUrl: string, size: "sm" | "lg"): string {
  return transformAvatarUrl(avatarUrl, TRANSFORM_SIZES[size]);
}
