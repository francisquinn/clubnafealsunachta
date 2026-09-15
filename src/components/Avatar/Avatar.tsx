import { useEffect, useState } from "react";
import { getAvatarColor, getAvatarLetter } from "../../lib/avatarColor";
import { getAvatarDisplayUrl } from "../../lib/avatarTransform";

// #70: React counterpart to Avatar.astro — same markup/classes, for use
// inside already-hydrated islands (EventRsvp.tsx's attendee lists,
// AccountMenu.tsx). Astro components can't be imported into a .tsx file, so
// this duplicates the (small) fallback rendering rather than sharing a
// template across the two frameworks.
interface AvatarProps {
  avatarUrl: string | null;
  alt: string;
  // Seed for the fallback letter-avatar's color — the member's id, so it
  // stays stable for them regardless of a display-name/username change.
  id: string;
  size?: "sm" | "lg";
}

export default function Avatar({ avatarUrl, alt, id, size = "sm" }: AvatarProps) {
  // A stored avatar_url can outlive its actual Storage object (the file
  // deleted out from under it, say) — this falls back to the letter avatar
  // on a broken image load instead of showing bare alt text.
  const [loadFailed, setLoadFailed] = useState(false);

  // Without this, swapping in a fresh preview after a prior broken/missing
  // avatarUrl left loadFailed stuck true (same component instance, no
  // remount) — the new preview would silently never show.
  useEffect(() => {
    setLoadFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !loadFailed) {
    return (
      <img
        className={`cnf-avatar cnf-avatar--${size}`}
        src={getAvatarDisplayUrl(avatarUrl, size)}
        alt={alt}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <div
      className={`cnf-avatar cnf-avatar--${size} cnf-avatar--fallback`}
      style={{ backgroundColor: getAvatarColor(id) }}
      aria-hidden="true"
    >
      {getAvatarLetter(alt)}
    </div>
  );
}
