import { useState } from 'react';
import { isOldEnough } from '../lib/ageGate.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS_SHOWN = 100;

/**
 * The first step of registering: when were you born. Neutral on purpose — no hint of the cut-off in the
 * question, nothing pre-selected — and it asks everyone the same. Only the month and year are asked for and
 * neither is stored; the answer decides this one thing and is then forgotten.
 */
export default function AgeGate({ onPassed, onTooYoung }) {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const thisYear = new Date().getFullYear();

  const submit = (event) => {
    event.preventDefault();
    const m = Number(month);
    const y = Number(year);
    if (isOldEnough(m, y)) onPassed({ month: m, year: y });
    else onTooYoung();
  };

  return (
    <form className="start-form age-gate" onSubmit={submit}>
      <p className="explanation">
        Before you register: when were you born? We ask everyone, and we do not keep the answer.
      </p>
      <div className="age-gate-fields">
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(e.target.value)} required>
            <option value="" disabled>
              Month
            </option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select value={year} onChange={(e) => setYear(e.target.value)} required>
            <option value="" disabled>
              Year
            </option>
            {Array.from({ length: YEARS_SHOWN }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" className="primary-button" disabled={!month || !year}>
        Continue
      </button>
    </form>
  );
}
