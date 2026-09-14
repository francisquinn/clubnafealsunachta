// #97: shared "on air" indicator — one markup source for EventCard and the
// event detail page, so the two can't drift out of visual sync. Pure/no
// state, so it renders fine from an Astro page with no client directive too.
export default function LiveBadge() {
  return (
    <span className="cnf-live-badge">
      <span className="cnf-live-badge__dot" aria-hidden="true" />
      In discussion
    </span>
  );
}
