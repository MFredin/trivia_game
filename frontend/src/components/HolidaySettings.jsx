import Plate from './Plate.jsx';
import Switch from './Switch.jsx';
import { HOLIDAYS } from '../constants/holidays.js';

/**
 * Settings → Appearance: the holiday overlay. Two switches, both on until a player turns them off: the overlay itself, and
 * whether it moves. The second is for someone who likes the scene but not the drifting fog and flying bats; it is separate
 * so that choice does not cost them the decoration. It only matters while a holiday is on, and the note says whether one is.
 */
export default function HolidaySettings({ scene, overlay, motion, onChange, error }) {
  const holiday = HOLIDAYS[scene];
  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Holiday overlay
      </p>
      <p className="explanation" id="holiday-status" style={{ margin: '0 0 1.2rem' }}>
        {holiday
          ? `${holiday.label} is on. The page is dressed for it until it ends.`
          : 'Nothing is on right now. Your choices are kept for the next holiday.'}
      </p>

      <div className="holiday-setting">
        <div className="holiday-setting-text">
          <label htmlFor="holiday-overlay" className="holiday-setting-title">
            Show the overlay
          </label>
          <p id="holiday-overlay-note" className="holiday-setting-note">
            Dresses the page for a holiday: a night sky behind the quiz, and decorations at the edges. It sits behind everything and
            never covers a question.
          </p>
        </div>
        <Switch id="holiday-overlay" checked={overlay} describedBy="holiday-overlay-note" onChange={(e) => onChange({ overlay: e.target.checked })} />
      </div>

      <div className="holiday-setting">
        <div className="holiday-setting-text">
          <label htmlFor="holiday-motion" className="holiday-setting-title">
            Animated background
          </label>
          <p id="holiday-motion-note" className="holiday-setting-note">
            Drifting fog, flying bats, rising lights. Off keeps the still scene. It always stops while a question is on screen, and
            your device's reduced-motion setting turns it off too.
          </p>
        </div>
        <Switch
          id="holiday-motion"
          checked={motion}
          disabled={!overlay}
          describedBy="holiday-motion-note"
          onChange={(e) => onChange({ motion: e.target.checked })}
        />
      </div>

      {error && (
        <div className="error-banner" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </Plate>
  );
}
