// Presentational: EventLiveActions decides whether (and with which link) to
// show it, from live data with a build-time fallback (#197).
export default function JoinEventButton({ meetingUrl }: { meetingUrl: string }) {
  return (
    <a
      href={meetingUrl}
      className="cnf-button cnf-button__gold"
      target="_blank"
      style={{ display: "inline-block" }}
    >
      <span className="cnf-button__text">Join online</span>
    </a>
  );
}
