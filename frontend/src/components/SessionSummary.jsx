import Leaderboard from './Leaderboard.jsx';

export default function SessionSummary({ totalScore, mode, entries, onPlayAgain }) {
  return (
    <div>
      <h2>Run complete</h2>
      <div className="summary-score">{totalScore}</div>
      <h3 style={{ marginBottom: '0.75rem' }}>Leaderboard — {mode === 'daily' ? 'Daily Challenge' : 'Classic'}</h3>
      <Leaderboard entries={entries} />
      <div style={{ marginTop: '1.5rem' }}>
        <button type="button" className="secondary-button" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  );
}
