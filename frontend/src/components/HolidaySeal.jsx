import { useContext } from 'react';
import { HolidayContext } from '../features/holiday/holidayContext.js';

// The small seal that stands where the house device does while a holiday is bound: the same lit pumpkin the plates carry, drawn from the
// symbols the overlay's defs hold (holidays/halloween.js), so it appears with the overlay and costs nothing of its own. It is a square of the same
// size as the device it stands in for, so the swap moves nothing on the card.
const SEALS = { halloween: ['hw-pkb', 'hw-f1'] };

export default function HolidaySeal({ size = 40, className = '' }) {
  const ids = SEALS[useContext(HolidayContext)];
  if (!ids) return null;
  return (
    <svg className={`holiday-seal ${className}`.trim()} width={size} height={size} viewBox="0 -6 100 100" aria-hidden="true" focusable="false">
      {ids.map((id) => (
        <use key={id} href={`#${id}`} />
      ))}
    </svg>
  );
}
