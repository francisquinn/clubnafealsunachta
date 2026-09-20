interface MembershipBadgeProps {
  clubs: string[];
  size?: "sm" | "lg";
}

export default function MembershipBadge({ clubs, size = "lg" }: MembershipBadgeProps) {
  if (!clubs || clubs.length === 0) {
    return null;
  }

  return (
    <div className="cnf-membership-badges" aria-label="Club memberships">
      {clubs.map((club) => (
        <span
          key={club}
          className={`cnf-membership-badge cnf-membership-badge--${size}`}
        >
          {club}
        </span>
      ))}
    </div>
  );
}