import { useEffect, useRef, useState } from "react";
import "../../styles/modal.css";

const ANIMATION_MS = 200;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // id of the heading that names the dialog for screen readers.
  labelledBy?: string;
  // Where focus goes on close. The browser returns it to whatever opened the
  // dialog, which is lost when that element is gone (e.g. a Join button
  // swapped for a Member button).
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function Modal({ isOpen, onClose, children, labelledBy, returnFocusRef }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.classList.add("cnf-modal-open");
    }

    if (!isOpen && dialog.open) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        dialog.close();
        document.body.classList.remove("cnf-modal-open");
        setIsClosing(false);
        returnFocusRef?.current?.focus();
      }, ANIMATION_MS);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isOpen, returnFocusRef]);

  useEffect(() => {
    return () => document.body.classList.remove("cnf-modal-open");
  }, []);

  function handleCancel(e: React.SyntheticEvent<HTMLDialogElement>) {
    e.preventDefault();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={`cnf-modal ${isClosing ? "cnf-modal--closing" : ""}`}
      aria-labelledby={labelledBy}
      onCancel={handleCancel}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <button type="button" className="cnf-modal__close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      {children}
    </dialog>
  );
}
