// #97: the "on air" indicator on event cards. Cards only: the prerendered
// event page would freeze a live check at build time (#137).
export default function LiveBadge() {
  return (
    <span className="cnf-live-badge">
      <span className="cnf-live-badge__dot" aria-hidden="true" />
      In discussion
    </span>
  );
}
