// The bats a player can catch on Halloween (features/holiday/useHolidayBats.js). These are the one thing the overlay draws that takes a tap, and
// that is on purpose, so they live outside the fixed layer that takes none. The flying one is above the page and below menus and dialogs
// (z-index 30, under the popovers' 40 and the modals' 50), and only its own small box answers the pointer: everything else of its layer lets
// taps through to the page. The perch is the one for keyboards and for a player with the animation off.
export function BatPerch({ place, bats }) {
  if (!bats?.perch) return null;
  return (
    <button
      type="button"
      className={['hol-perch', place === 'foot' ? 'hol-perch-foot' : 'hol-perch-wing', bats.perchHidden && 'is-key-only'].filter(Boolean).join(' ')}
      aria-label="A bat is hanging from the oak. Catch it."
      onClick={bats.catchPerch}
    >
      <svg viewBox="0 0 60 30" aria-hidden="true" focusable="false">
        <use href="#hw-bat" />
      </svg>
    </button>
  );
}

export default function HolidayBats({ bats }) {
  const { flyer } = bats;
  return (
    <>
      <BatPerch place="wing" bats={bats} />
      {flyer && (
        <div className="hol-batlayer">
          <div className={flyer.ltr ? 'hol-flywrap is-ltr' : 'hol-flywrap'} style={{ '--top': `${flyer.top}%`, '--dur': `${flyer.dur}s`, '--w': `${flyer.w}px` }} onAnimationEnd={bats.onFlyerEnd}>
            <button type="button" className={flyer.caught ? 'hol-flybat is-caught' : 'hol-flybat'} aria-label="A bat is flying past. Catch it." onClick={bats.catchFlyer}>
              <svg viewBox="0 0 60 30" aria-hidden="true" focusable="false">
                <use href="#hw-bat" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
