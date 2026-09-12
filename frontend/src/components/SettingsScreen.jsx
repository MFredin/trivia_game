import Plate from './Plate.jsx';
import { HOUSES } from '../constants/houses.js';

export default function SettingsScreen({ theme, onSelectTheme }) {
  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">The Bindery</p>
          <h2 className="screen-title">Choose Your Binding</h2>
        </div>
      </div>
      <Plate>
        <p className="explanation" style={{ margin: '0 0 1.4rem' }}>
          Pick a house and its colors — cover, trim, and ink — apply everywhere at once.
        </p>
        <div className="house-swatches">
          {HOUSES.map((house) => (
            <button
              key={house.id}
              type="button"
              className={`house-swatch ${theme === house.id ? 'is-active' : ''}`}
              onClick={() => onSelectTheme(house.id)}
            >
              <span
                className="house-swatch-chip"
                style={{ background: `linear-gradient(160deg, ${house.cover}, ${house.coverDeep})` }}
              >
                <span className="house-swatch-spine" style={{ background: house.accent }} />
              </span>
              {house.label}
            </button>
          ))}
        </div>
      </Plate>
    </div>
  );
}
