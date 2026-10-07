import { useContext } from 'react';
import { HolidayContext } from '../features/holiday/holidayContext.js';
import { useHolidayArt } from '../holidays/index.js';

// What a holiday puts on a plate: props on its edges and corners (a spider, a wreath, a chick), placed clear of the text padding. It is part
// of the plate, so it scrolls with it and exists at every screen width, which is how a phone, where the plates fill the width, gets the details.
// Rendered by Plate itself, so no screen has to know about it. display: contents keeps the wrapper out of the plate's layout.
export default function HolidayDressing() {
  const art = useHolidayArt(useContext(HolidayContext));
  if (!art) return null;
  return <span className="hol-wrap" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art.dressing }} />;
}
