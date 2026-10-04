import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';

/**
 * A button that opens a short list of actions — the "more" menu on a profile and the account
 * menu in the nav are both this. It does what a menu has to to be usable without a mouse: focus
 * moves into it on open, arrows walk it, Escape closes it and puts focus back on the button, and
 * so does a click anywhere outside.
 *
 * `items` are `{ key, label, icon?, danger?, onSelect }`. The trigger's content and class are the
 * caller's, so the same behaviour can be an icon button in one place and an avatar in another.
 */
export default function PopoverMenu({ label, trigger, triggerClassName, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const onMenuKeyDown = (e) => {
    const entries = [...rootRef.current.querySelectorAll('[role="menuitem"]')];
    const at = entries.indexOf(document.activeElement);
    const go = (i) => {
      e.preventDefault();
      entries[(i + entries.length) % entries.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(entries.length - 1);
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="popover-menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`popover-menu ${align === 'left' ? 'popover-menu--left' : 'popover-menu--right'}`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`popover-menu-item ${item.danger ? 'is-danger' : ''}`}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
