import Leaderboard from './Leaderboard.jsx';

const MODE_LABELS = {
  classic: 'Classic',
  daily: 'Daily Challenge',
  blitz: 'Blitz',
  survival: 'Survival',
};

export default function SessionSummary({
  totalScore,
  mode,
  category,
  canonSource,
  difficulty,
  entries,
  scope,
  onScopeChange,
  onPlayAgain,
}) {
  const segments = [MODE_LABELS[mode] ?? mode, category, difficulty].filter(Boolean);
  return (
    <div>
      <h2>Run complete</h2>
      <div className="summary-score">{totalScore}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <h3>Leaderboard — {segments.join(' · ')}</h3>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="secondary-button"
            style={scope === 'global' ? { borderColor: 'var(--brass-500)', color: 'var(--brass-500)' } : undefined}
            onClick={() => onScopeChange('global')}
          >
            Global
          </button>
          <button
            type="button"
            className="secondary-button"
            style={scope === 'friends' ? { borderColor: 'var(--brass-500)', color: 'var(--brass-500)' } : undefined}
            onClick={() => onScopeChange('friends')}
          >
            Friends
          </button>
        </div>
      </div>
      <Leaderboard entries={entries} />
      <div style={{ marginTop: '1.5rem' }}>
        <button type="button" className="secondary-button" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
