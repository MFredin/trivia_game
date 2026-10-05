import Plate from './Plate.jsx';
import HouseDevice from './HouseDevice.jsx';
import { HOUSES } from '../constants/houses.js';

/** Settings → Appearance: the house binding. Picking one rebinds every colour in the app at once. */
export default function AppearanceSettings({ theme, onSelectTheme }) {
  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        The Bindery
      </p>
      <p className="explanation" style={{ margin: '0 0 1.4rem' }}>
        Pick a house and its colors — cover, trim, and ink — apply everywhere at once.
      </p>
      <div className="house-swatches">
        {HOUSES.map((house) => (
          <button
            key={house.id}
            type="button"
            className={`house-swatch ${theme === house.id ? 'is-active' : ''}`}
            aria-pressed={theme === house.id}
            onClick={() => onSelectTheme(house.id)}
          >
            <span className="house-swatch-chip" style={{ background: `linear-gradient(160deg, ${house.cover}, ${house.coverDeep})` }}>
              <span className="house-swatch-spine" style={{ background: house.accent }} />
              <HouseDevice house={house.id} size={20} className="house-swatch-device" style={{ color: house.accent }} />
            </span>
            {house.label}
          </button>
        ))}
      </div>
    </Plate>
  );
}
