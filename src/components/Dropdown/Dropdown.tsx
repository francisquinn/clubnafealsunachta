import { useEffect, useId, useRef, useState } from "react";

interface DropdownProps {
  label: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  collapsesOnDesktop?: boolean;
  children: React.ReactNode;
}

export default function Dropdown({ label, triggerRef, collapsesOnDesktop, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    trigger.setAttribute("aria-controls", panelId);
    trigger.setAttribute("aria-label", label);

    function handleClick() {
      setIsOpen((open) => !open);
    }

    trigger.addEventListener("click", handleClick);
    return () => trigger.removeEventListener("click", handleClick);
  }, [triggerRef, panelId, label]);

  useEffect(() => {
    triggerRef.current?.setAttribute("aria-expanded", String(isOpen));
  }, [isOpen, triggerRef]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [triggerRef]);

  return (
    <div
      ref={panelRef}
      id={panelId}
      className={`cnf-dropdown__panel${collapsesOnDesktop ? " cnf-dropdown__panel--collapsible" : ""}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setIsOpen(false);
      }}
    >
      {children}
    </div>
  );
}
