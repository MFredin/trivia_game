import Plate from './Plate.jsx';
import Switch from './Switch.jsx';
import { HOLIDAYS, HOLIDAY_KEYS } from '../constants/holidays.js';

/**
 * Settings → Appearance: the holiday overlay. Two switches, both on until a player turns them off: the overlay itself, and whether it moves.
 * The second is for someone who likes the scene but not the drifting and flickering; it is separate so that choice does not cost them the
 * decoration. Both only matter while a holiday is on, and the note says whether one is.
 *
 * An admin also gets a list of every holiday, to see any of them on any day (to check a scene, or to show one off). It is part of the same plate
 * and shown to no one else: the server refuses the choice from anyone who is not an admin, and this does not offer it.
 */
export default function HolidaySettings({ holiday, onChange }) {
  const { scene, calendar, override, isAdmin, overlayOn, animated, error } = holiday;
  const label = (key) => HOLIDAYS[key]?.label;

  let status = 'Nothing is on right now. Your choices are kept for the next holiday.';
  if (override) {
    status = `You are previewing ${label(override)}, which you chose below. ${calendar ? `The calendar says ${label(calendar)}.` : 'The calendar says nothing is on.'}`;
  } else if (scene) {
    status = `${label(scene)} is on. The page is dressed for it until it ends.`;
  }

  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Holiday overlay
      </p>
      <p className="explanation" id="holiday-status" style={{ margin: '0 0 1.2rem' }}>
        {status}
      </p>

      <div className="holiday-setting">
        <div className="holiday-setting-text">
          <label htmlFor="holiday-overlay" className="holiday-setting-title">
            Show the overlay
          </label>
          <p id="holiday-overlay-note" className="holiday-setting-note">
            Decorates the plates and the page around them for a holiday. It sits behind everything and never covers a question.
          </p>
        </div>
        <Switch id="holiday-overlay" checked={overlayOn} describedBy="holiday-overlay-note" onChange={(e) => onChange({ overlay: e.target.checked })} />
      </div>

      <div className="holiday-setting">
        <div className="holiday-setting-text">
          <label htmlFor="holiday-motion" className="holiday-setting-title">
            Animated background
          </label>
          <p id="holiday-motion-note" className="holiday-setting-note">
            Things that drift, hang and flicker. Off keeps the still scene. It always stops while a question is on screen, and your device's
            reduced-motion setting turns it off too.
          </p>
        </div>
        <Switch
          id="holiday-motion"
          checked={animated}
          disabled={!overlayOn}
          describedBy="holiday-motion-note"
          onChange={(e) => onChange({ motion: e.target.checked })}
        />
      </div>

      {isAdmin && (
        <div className="holiday-setting">
          <div className="holiday-setting-text">
            <label htmlFor="holiday-override" className="holiday-setting-title">
              Overlay to show <span className="holiday-badge">Admins only</span>
            </label>
            <p id="holiday-override-note" className="holiday-setting-note">
              Pick any holiday to see it whatever the date. Automatic follows the calendar, as it does for everyone else.
            </p>
          </div>
          <select
            id="holiday-override"
            className="holiday-select"
            value={override ?? 'auto'}
            aria-describedby="holiday-override-note"
            onChange={(e) => onChange({ override: e.target.value === 'auto' ? null : e.target.value })}
          >
            <option value="auto">Automatic</option>
            {HOLIDAY_KEYS.map((key) => (
              <option key={key} value={key}>
                {label(key)}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </Plate>
  );
}
