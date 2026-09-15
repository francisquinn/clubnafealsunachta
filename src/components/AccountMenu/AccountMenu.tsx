import { useEffect, useRef, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";
import Avatar from "../Avatar/Avatar";
import { fetchSessionInfo, getCachedMember, clearCachedMember, type SessionInfo } from "../../utils/session";
import { getDisplayName } from "../../lib/memberDisplay";

interface AccountMenuProps {
  pathname: string;
}

export default function AccountMenu({ pathname }: AccountMenuProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  // Seeded from localStorage (see session.ts) so a returning member's real
  // avatar paints on the very first frame, before /api/me even resolves —
  // every page load is a fresh JS context in this MPA, so without this
  // there'd be nothing to show but the skeleton below on every single page.
  const [member, setMember] = useState<SessionInfo["member"]>(() => getCachedMember());
  // Only a true first-ever load (nothing cached yet) needs the skeleton;
  // a cached member means we already have something real to paint.
  const [loaded, setLoaded] = useState(() => getCachedMember() !== null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchSessionInfo().then((data) => {
      setIsAdmin(!!data.isAdmin);
      setMember(data.member ?? null);
      setLoaded(true);
    });
  }, []);

  // Without this, a stale cached avatar from a previous member would flash
  // on a shared/kiosk browser the moment someone else logs in next (the
  // login flow does a full page reload) — logout is the one place we know
  // for certain the signed-out member's cache should stop being shown.
  function handleLogout() {
    clearCachedMember();
  }

  return (
    <>
      <button type="button" ref={toggleRef} className="cnf-account__toggle">
        {loaded ? (
          <Avatar
            avatarUrl={member?.avatar_url ?? null}
            alt={member ? getDisplayName(member) : "Account"}
            id={member?.id ?? "account"}
            size="sm"
          />
        ) : (
          <div className="cnf-avatar cnf-avatar--sm cnf-avatar--skeleton" aria-hidden="true" />
        )}
      </button>
      <Dropdown label="Account menu" triggerRef={toggleRef}>
        <a className={`cnf-nav__link ${pathname.startsWith("/profile") ? "tab-active" : ""}`} href="/profile">
          Profile
        </a>
        {isAdmin && (
          <a className={`cnf-nav__link ${pathname.startsWith("/admin") ? "tab-active" : ""}`} href="/admin">
            Admin console
          </a>
        )}
        <form method="POST" action="/api/logout" onSubmit={handleLogout}>
          <button type="submit" className="cnf-nav__link cnf-nav__link--button cnf-nav__link--danger">
            Logout
          </button>
        </form>
      </Dropdown>
    </>
  );
}
