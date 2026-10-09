import { useContext } from 'react';
import { HolidayContext } from '../features/holiday/holidayContext.js';
import { useHolidayArt } from '../holidays/index.js';
import { BatPerch } from './HolidayBats.jsx';

// A scene at the end of every page, above the footer: a graveyard, a laid table, a windowsill of candles. It sits in the page flow, so it is
// text-free by construction and its detail never costs anything its legibility; and being in the flow rather than fixed, it is not cut off,
// however short the screen. A screen 1280px or wider has the margin scene and its own ground instead, so the foot is not drawn there.
export default function HolidayFoot({ bats }) {
  const art = useHolidayArt(useContext(HolidayContext));
  if (!art) return null;
  // The wrapper only gives the perch something to hang from; it adds no box of its own to the page (the foot's margin runs through it).
  return (
    <div className="hol-footwrap">
      <div className="hol-wrap" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art.foot }} />
      <BatPerch place="foot" bats={bats} />
    </div>
  );
}
