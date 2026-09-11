import { DIFFICULTY_TIERS } from '../constants/difficulty.js';

export default function DifficultySlider({ value, onChange }) {
  const index = Math.max(
    0,
    DIFFICULTY_TIERS.findIndex((t) => t.value === value),
  );
  const current = DIFFICULTY_TIERS[index];

  return (
    <div className="difficulty-slider">
      <input
        type="range"
        min={0}
        max={DIFFICULTY_TIERS.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(DIFFICULTY_TIERS[Number(e.target.value)].value)}
        className="rs-range"
        aria-label="Difficulty"
      />
      <div className="difficulty-ticks">
        {DIFFICULTY_TIERS.map((tier, i) => (
          <span key={tier.value || 'any'} className={i === index ? 'is-active' : ''}>
            {tier.label}
          </span>
        ))}
      </div>
      <p className="difficulty-desc">{current.description}</p>
    </div>
  );
}
