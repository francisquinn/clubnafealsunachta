// A separate palette from the site's brand colors (--color-green etc.) —
// picked purely for variety and to stay readable with the fixed white
// avatar-letter text, not to match the rest of the UI.
export const AVATAR_PALETTE = [
  "#C0392B", // red
  "#B9770E", // amber
  "#1E8449", // green
  "#117864", // teal
  "#2471A3", // blue
  "#4A3F8C", // indigo
  "#6C3483", // violet
  "#A93266", // berry
] as const;

// Deterministic per-member color: hashes a stable seed (the member's id)
// into an index into AVATAR_PALETTE, so a member's fallback avatar color
// stays the same across renders/reloads without needing to store one.
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // keep it a 32-bit int
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0];
}

// Shared by Avatar.tsx, Avatar.astro, and auth.ts's avatarHintValue — all
// three render the same fallback letter and previously derived it
// independently.
export function getAvatarLetter(displayName: string): string {
  return displayName.charAt(0).toUpperCase();
}
