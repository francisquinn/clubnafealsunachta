import { useEffect, useRef } from "react";
import Dropdown from "../Dropdown/Dropdown";

interface NavSubmenuProps {
  label: string;
  // The current page is one of the submenu's links, so the trigger is marked
  // as current too.
  active?: boolean;
  // Opens the group whenever this becomes true, e.g. the mobile menu opening
  // on one of the group's own pages. Closing is left to the user.
  expandWhen?: boolean;
  children: React.ReactNode;
}

// A group of nav links under one trigger. Layout lives in nav.css: a dropdown
// panel on desktop, an accordion inside the mobile overlay.
export default function NavSubmenu({ label, active, expandWhen, children }: NavSubmenuProps) {
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = toggleRef.current;
    if (expandWhen && trigger?.getAttribute("aria-expanded") !== "true") trigger?.click();
  }, [expandWhen]);

  return (
    <div className="cnf-nav__submenu">
      <button
        type="button"
        ref={toggleRef}
        className={`cnf-nav__link cnf-nav__link--button cnf-nav__submenu-toggle ${active ? "tab-active" : ""}`}
      >
        {label}
      </button>
      <Dropdown label={label} triggerRef={toggleRef}>
        {children}
      </Dropdown>
    </div>
  );
}
