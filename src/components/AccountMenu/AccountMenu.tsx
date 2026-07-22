import { useEffect, useRef, useState } from "react";
import Dropdown from "../Dropdown/Dropdown";

interface AccountMenuProps {
  pathname: string;
}

export default function AccountMenu({ pathname }: AccountMenuProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(!!data.isAdmin));
  }, []);

  return (
    <>
      <button type="button" ref={toggleRef} className="cnf-account__toggle">
        <svg className="cnf-account__icon" viewBox="0 0 640 640" fill="none" aria-hidden="true">
          <path d="M320 320C381.714 320 432 269.714 432 208C432 146.286 381.714 96 320 96C258.286 96 208 146.286 208 208C208 269.714 258.286 320 320 320Z" fill="currentColor" stroke="currentColor" strokeWidth="30" />
          <path d="M240.342 371.056C296.065 429.317 337.513 499.249 375.732 572.386C275.261 574.83 180.136 569.893 79 559.783V496C79.0001 464.61 99.5053 437.24 133.015 414.795C164.018 394.029 203.78 379.231 240.342 371.056Z" fill="hsl(var(--color-beige))" stroke="currentColor" strokeWidth="30" />
          <path d="M240 373.334C305.778 440.001 344 490.122 386.667 573.5C440 573.499 501.333 566.034 557.333 560.167V461.5C557.333 394.834 477.333 354.834 397.333 384.167C360 405.5 328 408.167 301.333 386.834C280 370.834 266.667 386.667 240 373.334Z" fill="currentColor" stroke="currentColor" strokeWidth="30" />
          <path d="M240 400C254.728 400 266.667 388.061 266.667 373.333C266.667 358.606 254.728 346.667 240 346.667C225.272 346.667 213.333 358.606 213.333 373.333C213.333 388.061 225.272 400 240 400Z" fill="hsl(var(--color-gold))" />
        </svg>
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
        <form method="POST" action="/api/logout">
          <button type="submit" className="cnf-nav__link cnf-nav__link--button cnf-nav__link--danger">
            Logout
          </button>
        </form>
      </Dropdown>
    </>
  );
}
