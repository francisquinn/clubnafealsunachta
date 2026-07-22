import { useRef } from "react";
import Dropdown from "../Dropdown/Dropdown";

interface NavMenuProps {
  pathname: string;
}

export default function NavMenu({ pathname }: NavMenuProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="cnf-nav__group">
      <button type="button" ref={toggleRef} className="cnf-nav__toggle">
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
        <span className="cnf-nav__toggle-bar"></span>
      </button>
      <Dropdown label="Menu" triggerRef={toggleRef} collapsesOnDesktop>
        <a
          className={`cnf-nav__link ${pathname.startsWith("/about") ? "tab-active" : ""}`}
          href="/about/"
        >
          About
        </a>
        <a
          className={`cnf-nav__link ${pathname.startsWith("/events") ? "tab-active" : ""}`}
          href="/events/"
        >
          Events
        </a>
        <a
          className={`cnf-nav__link ${pathname.startsWith("/blog") || pathname.startsWith("/post") ? "tab-active" : ""}`}
          href="/blog/"
        >
          Blog
        </a>
      </Dropdown>
    </div>
  );
}
