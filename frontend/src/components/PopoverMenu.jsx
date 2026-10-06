import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './icons.jsx';

/**
 * A button that opens a short list of actions — the "more" menu on a profile and the account
 * menu in the nav are both this. It does what a menu has to to be usable without a mouse: focus
 * moves into it on open, arrows walk it, Escape closes it and puts focus back on the button, and
 * so does a click anywhere outside.
 *
 * `items` are `{ key, label, icon?, danger?, onSelect }`; `header` is an optional non-interactive
 * block above them (who the menu belongs to). The trigger's content and class are the
 * caller's, so the same behaviour can be an icon button in one place and an avatar in another.
 */
// How close to the edge of the screen a menu may come.
const SCREEN_MARGIN_PX = 8;

export default function PopoverMenu({ label, trigger, triggerClassName, triggerCurrent = false, items, header, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Keep the menu on the screen. It is anchored to its button's edge, but where the button sits depends on how the
  // header wrapped: with larger text or a narrow phone the avatar can end up at the left of its row, and a menu
  // opening leftwards from there ran off the screen with its labels cut off. So after it opens, measure it and slide
  // it back inside by whatever it overhangs. Re-checked when the window changes size (rotation, text zoom).
  useLayoutEffect(() => {
    if (!open) return undefined;
    const keepOnScreen = () => {
      const menu = menuRef.current;
      if (!menu) return;
      menu.style.transform = '';
      const { left, right } = menu.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      if (left < SCREEN_MARGIN_PX) menu.style.transform = `translateX(${SCREEN_MARGIN_PX - left}px)`;
      else if (right > width - SCREEN_MARGIN_PX) menu.style.transform = `translateX(${width - SCREEN_MARGIN_PX - right}px)`;
    };
    keepOnScreen();
    window.addEventListener('resize', keepOnScreen);
    return () => window.removeEventListener('resize', keepOnScreen);
  }, [open]);

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
        aria-current={triggerCurrent ? 'page' : undefined}
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
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={`popover-menu ${align === 'left' ? 'popover-menu--left' : 'popover-menu--right'}`}
          onKeyDown={onMenuKeyDown}
        >
          {header && <div className="popover-menu-header">{header}</div>}
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
