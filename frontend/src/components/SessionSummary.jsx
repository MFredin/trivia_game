import Plate from './Plate.jsx';
import Leaderboard from './Leaderboard.jsx';
import ShareResultButton from './ShareResultButton.jsx';
import SealDevice from './SealDevice.jsx';
import { buildRunShareText } from '../lib/shareResult.js';
import { toRoman } from '../lib/roman.js';
import { gradeForAccuracy } from '../lib/grade.js';

const MODE_LABELS = {
  classic: 'Classic',
  daily: 'Daily Challenge',
  blitz: 'Blitz',
  survival: 'Survival',
  gauntlet: 'Gauntlet',
  duel: 'Duel',
};

const MAX_FOLIO_PIPS = 20;

function FolioPip({ correct }) {
  return correct ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* success-ink, not verdigris: these marks are the run's per-question record, so
          they have to clear 3:1 as meaningful graphics — verdigris reads 2.71:1 here. */}
      <path d="M4 12l5 5 11-11" stroke="var(--success-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="var(--oxblood-600)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function SessionSummary({
  totalScore,
  mode,
  category,
  canonSource,
  difficulty,
  bestStreak,
  correctCount,
  answeredCount,
  runCorrectness,
  house,
  entries,
  scope,
  window,
  onScopeChange,
  onWindowChange,
  onPlayAgain,
}) {
  const segments = [MODE_LABELS[mode] ?? mode, category, difficulty].filter(Boolean);
  const currentLabel = mode === 'daily' ? 'Today' : 'This Week';
  const shareText = buildRunShareText({ totalScore, mode, category, difficulty, bestStreak });
  const grade = gradeForAccuracy(correctCount, answeredCount);
  const gradeLine = grade && difficulty ? `${grade} at ${difficulty}` : grade;
  const wrongCount = answeredCount - correctCount;
  const firstWrongIndex = runCorrectness.findIndex((c) => !c);
  const slipNote =
    wrongCount === 0
      ? 'A clean run — not a single slip.'
      : `${wrongCount} slip${wrongCount > 1 ? 's' : ''}${firstWrongIndex >= 0 ? `, first on folio ${toRoman(firstWrongIndex + 1).toLowerCase()}` : ''}.`;
  const visiblePips = runCorrectness.slice(0, MAX_FOLIO_PIPS);
  const hiddenCount = runCorrectness.length - visiblePips.length;

  return (
    <div>
      <div className="summary-seal-wrap">
        <SealDevice house={house} size={190} />
        <Plate className="summary-plate">
          <div className="summary-headline">
            <p className="screen-eyebrow" style={{ margin: 0 }}>
              {segments.join(' · ')}
            </p>
            <div className="summary-numeral">
              <span>{toRoman(correctCount)}</span>
              <span className="summary-numeral-of">of {toRoman(answeredCount)}</span>
            </div>
            {gradeLine && <p className="summary-grade">{gradeLine}</p>}
            <p className="explanation" style={{ margin: 0 }}>
              {totalScore.toLocaleString()} points &middot; best streak of {bestStreak}
            </p>
          </div>

          <div className="rule-rubric" style={{ margin: '1.2rem 0' }} />

          <div className="folio-strip">
            <p className="screen-eyebrow" style={{ fontSize: '0.68rem', margin: '0 0 0.6rem' }}>
              Folio by folio
            </p>
            <div className="folio-pips">
              {visiblePips.map((correct, i) => (
                <FolioPip key={i} correct={correct} />
              ))}
              {hiddenCount > 0 && <span className="folio-more">+{hiddenCount} more</span>}
            </div>
            <p className="explanation" style={{ margin: '0.5rem 0 0', fontStyle: 'italic' }}>
              {slipNote}
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.4rem' }}>
            <ShareResultButton text={shareText} />
          </div>
        </Plate>
      </div>

      <div className="screen-head" style={{ marginTop: '2.4rem' }}>
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
          Open another volume
        </button>
      </div>
    </div>
  );
}
