import { useEffect, useRef } from 'react';

/**
 * The overlay-and-plate shell both modals were writing out by hand.
 *
 * Pulled into one place during the platform audit, because the copies had drifted into being
 * a dialog in appearance only: neither announced itself as one, neither could be dismissed
 * from the keyboard, and opening one left focus behind on the button that opened it, so a
 * screen reader carried on reading the page underneath.
 */
export default function Modal({ onClose, labelledBy, children }) {
  const plateRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // Focus the dialog itself rather than the first control inside it: the heading and the
    // explanation above the buttons are the point, and jumping straight to a button skips them.
    plateRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    // The overlay closes on click as a convenience. It is not the only way out — every modal
    // carries a real button — so it needs no keyboard handler of its own.
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={plateRef}
        className="modal-plate"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
