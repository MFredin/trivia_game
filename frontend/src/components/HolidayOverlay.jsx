import { useHolidayArt } from '../holidays/index.js';

// The seasonal backdrop, mounted once in App.jsx while a holiday is on and the player has not turned it off: a fixed layer behind the whole
// page. It ignores the pointer, is hidden from screen readers, and paints below every piece of content, so nothing is ever drawn over a
// question, an answer, a button or the timer. It also carries the SVG symbols the plates' dressing and the page's foot draw with, which is why
// those two appear only once it does.
//
// What is drawn, per holiday, is in holidays/<key>.js; how, and the rules every holiday follows, are in styles/parts/holiday-overlay.css.
export default function HolidayOverlay({ scene }) {
  const art = useHolidayArt(scene);
  if (!art) return null;
  return <div className="holiday" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art.defs + art.backdrop }} />;
}
