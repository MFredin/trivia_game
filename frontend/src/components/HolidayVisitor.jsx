import { HOLIDAYS } from '../constants/holidays.js';

// The creature a player can catch while a holiday is on (features/holiday/useHolidayVisitor.js): a bat, a turkey, an owl. It is the one thing
// the overlay draws that takes a tap, and that is on purpose, so it lives outside the fixed layer that takes none. The flying one is above the
// page and below menus and dialogs (z-index 30, under the popovers' 40 and the modals' 50), and only its own small box answers the pointer:
// everything else of its layer lets taps through to the page. The perch is the one for keyboards and for a player with the animation off.
// The drawing is the holiday's own symbol in its defs, so nothing here knows what the creature looks like.
export function VisitorPerch({ place, visitor }) {
  const config = HOLIDAYS[visitor.scene]?.visitor;
  if (!config || !visitor.perch) return null;
  return (
    <button
      type="button"
      className={['hol-perch', place === 'foot' ? 'hol-perch-foot' : 'hol-perch-wing', visitor.perchHidden && 'is-key-only'].filter(Boolean).join(' ')}
      data-visitor={config.kind}
      aria-label={config.perch}
      onClick={visitor.catchPerch}
    >
      <svg viewBox={config.viewBox} aria-hidden="true" focusable="false">
        <use href={`#${config.symbol}`} />
      </svg>
    </button>
  );
}

export default function HolidayVisitor({ visitor }) {
  const { flyer } = visitor;
  const config = HOLIDAYS[visitor.scene]?.visitor;
  return (
    <>
      <VisitorPerch place="wing" visitor={visitor} />
      {flyer && config && (
        <div className="hol-visitorlayer">
          <div
            className={flyer.ltr ? 'hol-flywrap is-ltr' : 'hol-flywrap'}
            style={{ [config.lane === 'ground' ? '--bottom' : '--top']: `${flyer.pos}%`, '--dur': `${flyer.dur}s`, '--w': `${flyer.w}px` }}
            onAnimationEnd={visitor.onFlyerEnd}
          >
            <button type="button" className={flyer.caught ? 'hol-flyer is-caught' : 'hol-flyer'} data-visitor={config.kind} aria-label={config.label} onClick={visitor.catchFlyer}>
              <svg viewBox={config.viewBox} aria-hidden="true" focusable="false">
                <use href={`#${config.symbol}`} />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
