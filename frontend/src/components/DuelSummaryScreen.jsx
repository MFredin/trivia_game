import Plate from './Plate.jsx';

export default function DuelSummaryScreen({ yourScore, opponentUsername, result, onDone }) {
  const waiting = !result;
  const outcome = waiting
    ? null
    : yourScore > result.opponentScore
      ? 'win'
      : yourScore < result.opponentScore
        ? 'loss'
        : 'tie';

  return (
    <div>
      <p className="screen-eyebrow" style={{ textAlign: 'center' }}>
        Duel Concluded
      </p>
      <h2 className="screen-title" style={{ textAlign: 'center' }}>
        {waiting ? 'Awaiting Opponent' : outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'A Tie'}
      </h2>
      <Plate>
        {waiting ? (
          <p className="explanation" style={{ textAlign: 'center' }}>
            Waiting for {opponentUsername ?? 'your opponent'} to finish their run&hellip;
          </p>
        ) : (
          <div className="duel-result-grid">
            <div className={`duel-result-side ${outcome === 'win' ? 'is-winner' : ''}`}>
              <span className="duel-result-name">You</span>
              <span className="duel-result-score">{yourScore}</span>
            </div>
            <div className="duel-result-vs">vs</div>
            <div className={`duel-result-side ${outcome === 'loss' ? 'is-winner' : ''}`}>
              <span className="duel-result-name">{opponentUsername}</span>
              <span className="duel-result-score">{result.opponentScore}</span>
            </div>
          </div>
        )}
      </Plate>
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button type="button" className="primary-button" onClick={onDone} disabled={waiting}>
          Done
        </button>
      </div>
    </div>
  );
}
