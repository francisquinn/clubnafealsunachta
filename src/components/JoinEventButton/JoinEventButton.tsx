import type { Event } from "../../types/types";
import { isEventExpired } from "../../utils/script";

export default function JoinEventButton({ event }: JoinEventButtonProps) {
  const { isOnline, meetingUrl } = event;

  if (!isOnline || !meetingUrl || isEventExpired(event)) {
    return null;
  }

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

type JoinEventButtonProps = {
  event: Event;
};