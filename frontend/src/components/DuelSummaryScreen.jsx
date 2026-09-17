import Plate from './Plate.jsx';
import SealDevice from './SealDevice.jsx';
import ShareResultButton from './ShareResultButton.jsx';
import { buildDuelShareText } from '../lib/shareResult.js';

export default function DuelSummaryScreen({ yourScore, opponentUsername, result, house, onDone }) {
  const waiting = !result;
  const outcome = waiting
    ? null
    : yourScore > result.opponentScore
      ? 'win'
      : yourScore < result.opponentScore
        ? 'loss'
        : 'tie';
  const shareText = waiting
    ? null
    : buildDuelShareText({ yourScore, opponentScore: result.opponentScore, opponentUsername, outcome });

  return (
    <div>
      {waiting ? (
        <>
          <p className="screen-eyebrow" style={{ textAlign: 'center' }}>
            Duel Concluded
          </p>
          <h2 className="screen-title" style={{ textAlign: 'center' }}>
            Awaiting Opponent
          </h2>
          <Plate>
            <p className="explanation" style={{ textAlign: 'center' }}>
              Waiting for {opponentUsername ?? 'your opponent'} to finish their run&hellip;
            </p>
          </Plate>
        </>
      ) : (
        <div className="summary-seal-wrap">
          <SealDevice house={house} size={190} />
          <Plate className="summary-plate">
            <p className="screen-eyebrow" style={{ textAlign: 'center', margin: 0 }}>
              Duel Concluded
            </p>
            <h2 className="screen-title" style={{ textAlign: 'center', margin: '0 0 1.2rem' }}>
              {outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'A Tie'}
            </h2>
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
            {shareText && (
              <div style={{ marginTop: '1.4rem', textAlign: 'center' }}>
                <ShareResultButton text={shareText} />
              </div>
            )}
          </Plate>
        </div>
      )}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button type="button" className="primary-button" onClick={onDone} disabled={waiting}>
          Done
        </button>
      </div>
    </div>
  );
}
