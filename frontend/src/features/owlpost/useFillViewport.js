import { useLayoutEffect } from 'react';

/**
 * Sizes a scrolling area to take what is left of the screen, so the thing under it (a composer) is always in
 * view and the page itself does not lengthen. CSS alone cannot do this: how much is above the area (a header
 * that wraps to two lines on a phone, an error banner) is not known to the stylesheet.
 *
 * The room is the visible height, less where the area starts on the page, less everything below it that is not
 * the area. `visualViewport` is used where there is one because on a phone it shrinks when the keyboard opens,
 * which is exactly when the composer must stay above it. Re-measured on every render and whenever the window or
 * the composer changes size.
 */
export function useFillViewport(scrollerRef, composerRef, { minPx = 192, gapPx = 8 } = {}) {
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const composer = composerRef.current;
    if (!scroller || !composer) return undefined;

    const fit = () => {
      const visible = window.visualViewport?.height ?? window.innerHeight;
      const area = scroller.getBoundingClientRect();
      // Below the area and not part of it: the plate's padding, the composer and its margin. This does not
      // depend on the area's own height, so measuring it now is safe.
      const below = composer.getBoundingClientRect().bottom - area.bottom;
      const startsAt = area.top + window.scrollY;
      scroller.style.maxHeight = `${Math.max(minPx, Math.floor(visible - startsAt - below - gapPx))}px`;
    };

    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(composer);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      observer?.disconnect();
    };
  });
}
