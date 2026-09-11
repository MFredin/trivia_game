import Plate from './Plate.jsx';
import Leaderboard from './Leaderboard.jsx';

const MODE_LABELS = {
  classic: 'Classic',
  daily: 'Daily Challenge',
  blitz: 'Blitz',
  survival: 'Survival',
  gauntlet: 'Gauntlet',
  duel: 'Duel',
};

export default function SessionSummary({
  totalScore,
  mode,
  category,
  canonSource,
  difficulty,
  entries,
  scope,
  window,
  onScopeChange,
  onWindowChange,
  onPlayAgain,
}) {
  const segments = [MODE_LABELS[mode] ?? mode, category, difficulty].filter(Boolean);
  const currentLabel = mode === 'daily' ? 'Today' : 'This Week';
  return (
    <div>
      <p className="screen-eyebrow" style={{ textAlign: 'center' }}>
        Enquiry Concluded
      </p>
      <h2 className="screen-title" style={{ textAlign: 'center' }}>
        Run Complete
      </h2>
      <div className="summary-score">{totalScore}</div>

      <div className="screen-head">
        <h3 className="screen-title" style={{ fontSize: '1.1rem' }}>
          Leaderboard — {segments.join(' · ')}
        </h3>
        <div className="nav-links">
          <button
            type="button"
            className={`nav-btn ${window === 'current' ? 'is-active' : ''}`}
            onClick={() => onWindowChange('current')}
          >
            {currentLabel}
          </button>
          <button
            type="button"
            className={`nav-btn ${window === 'all' ? 'is-active' : ''}`}
            onClick={() => onWindowChange('all')}
          >
            All Time
          </button>
          <span style={{ width: '1px', background: 'rgba(18,21,28,0.16)', margin: '0 0.2rem' }} />
          <button
            type="button"
            className={`nav-btn ${scope === 'global' ? 'is-active' : ''}`}
            onClick={() => onScopeChange('global')}
          >
            Global
          </button>
          <button
            type="button"
            className={`nav-btn ${scope === 'friends' ? 'is-active' : ''}`}
            onClick={() => onScopeChange('friends')}
          >
            Friends
          </button>
        </div>
      </div>

      <Plate>
        <Leaderboard entries={entries} />
      </Plate>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button type="button" className="primary-button" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
