import { useEffect, useRef, useState } from 'react';
import Plate from './Plate.jsx';
import TimerDial from './TimerDial.jsx';
import { toRoman } from '../lib/roman.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const FLIP_OUT_MS = 480;
const FLIP_IN_MS = 560;
const MAX_STREAK_PIPS = 6;

// Only these modes deal out a fixed-length run — Blitz/Survival/Gauntlet play until the
// clock or a miss ends things, so "of X" would be a made-up target rather than a real one.
const FIXED_LENGTH = { classic: 10, daily: 10, duel: 10, challenge: 10 };

function CheckIcon() {
  return (
    <svg className="choice-mark" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="choice-mark" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EmberPip({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 2 2 3 2 5 0-4-1-6 1-9z"
        fill={filled ? 'var(--rubric)' : 'none'}
        stroke="var(--rubric)"
        strokeWidth={filled ? 0 : 1.2}
      />
    </svg>
  );
}

export default function QuestionCard({
  question,
  timeLimitMs,
  issuedAt,
  timingMode,
  sessionCreatedAt,
  mode,
  streak,
  strikes,
  maxStrikes,
  totalScore,
  feedback,
  onSubmit,
}) {
  const [remainingMs, setRemainingMs] = useState(timeLimitMs);
  const hasTimedOutRef = useRef(false);
  const anchor = timingMode === 'session_total' ? sessionCreatedAt : issuedAt;

  useEffect(() => {
    hasTimedOutRef.current = false;
    const anchorMs = new Date(anchor).getTime();

    const tick = () => {
      const remaining = Math.max(0, timeLimitMs - (Date.now() - anchorMs));
      setRemainingMs(remaining);
      if (remaining === 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        onSubmit(-1);
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [question.question_id, anchor, timeLimitMs, onSubmit]);

  // The visible "page" (catalog tabs + spread) lags one tick behind `question` so it can
  // finish turning away from the old content before swapping in the new — see the page-turn
  // animation below. Everything else (timer, streak, strikes) stays bound to the live props.
  // Blitz races a single shared time budget (timingMode: 'session_total'), so the leisurely
  // page-turn would tax the run itself — skip straight through there instead of playing it.
  const isInstant = timingMode === 'session_total';
  const [displayedQuestion, setDisplayedQuestion] = useState(question);
  const [flipPhase, setFlipPhase] = useState('idle');
  // Folio numeral — starts at 1 for a fresh session (QuestionCard is remounted per session
  // via a key on session id) and advances every time a new question actually arrives.
  const [questionIndex, setQuestionIndex] = useState(1);

  useEffect(() => {
    if (question.question_id === displayedQuestion.question_id) return undefined;
    setFlipPhase('out');
    const outTimer = setTimeout(
      () => {
        setDisplayedQuestion(question);
        setQuestionIndex((i) => i + 1);
        setFlipPhase('in');
      },
      isInstant ? 0 : FLIP_OUT_MS,
    );
    return () => clearTimeout(outTimer);
  }, [question, displayedQuestion, isInstant]);

  useEffect(() => {
    if (flipPhase !== 'in') return undefined;
    const inTimer = setTimeout(() => setFlipPhase('idle'), isInstant ? 0 : FLIP_IN_MS);
    return () => clearTimeout(inTimer);
  }, [flipPhase, isInstant]);

  const flipClass = flipPhase === 'out' ? 'is-turning-out' : flipPhase === 'in' ? 'is-turning-in' : '';
  const inputLocked = Boolean(feedback) || flipPhase !== 'idle';
  const total = FIXED_LENGTH[mode];
  const pipCount = Math.min(streak, MAX_STREAK_PIPS);

  return (
    <div className={`page-flip-stage ${isInstant ? 'is-instant' : ''}`}>
      <div className={`page-flip ${flipClass}`}>
        <div className="catalog-tabs">
          <div className="catalog-tab">{displayedQuestion.obscurity_tier}</div>
          <div className="catalog-tab">{displayedQuestion.category}</div>
          {displayedQuestion.divergence && <div className="catalog-tab catalog-tab--divergence">Divergence</div>}
        </div>
        <Plate
          className="book-spread--tabbed"
          secondary={
            <div className="qcard-margin">
              <p className="screen-eyebrow" style={{ fontSize: '0.72rem' }}>
                Question
              </p>
              <div className="qcard-margin-numeral">
                <span>{toRoman(questionIndex)}</span>
                {total && <span className="qcard-margin-numeral-of">of {toRoman(total)}</span>}
              </div>
              <div className="rule-rubric" style={{ margin: '0.9rem 0 1.1rem' }} />
              <div className="qcard-margin-dial">
                <p className="qcard-margin-stat-label">Remaining</p>
                <TimerDial remainingMs={remainingMs} totalMs={timeLimitMs} size={116} />
              </div>
              <div className="qcard-margin-hairline" />
              <div className="qcard-margin-stat">
                <span className="qcard-margin-stat-label">Streak</span>
                <span className="streak-pips" aria-label={`streak of ${streak}`}>
                  {Array.from({ length: pipCount }, (_, i) => <EmberPip key={i} filled />)}
                  <span className="streak-pips-number">{streak}</span>
                </span>
              </div>
              {maxStrikes != null && (
                <div className="qcard-margin-stat">
                  <span className="qcard-margin-stat-label">Strikes</span>
                  <span className="strikes" aria-label={`${strikes} of ${maxStrikes} strikes`}>
                    {Array.from({ length: maxStrikes }, (_, i) => (
                      <span key={i} className={`strike-dot ${i < strikes ? 'is-used' : ''}`} />
                    ))}
                  </span>
                </div>
              )}
              {totalScore != null && (
                <div className="qcard-margin-score">
                  <span className="qcard-margin-stat-label">Score so far</span>
                  <span className="qcard-margin-score-value">{totalScore.toLocaleString()}</span>
                </div>
              )}
            </div>
          }
        >
          <p className="question-text has-rubric-initial">{displayedQuestion.question_text}</p>
          <ul className="choice-list">
            {displayedQuestion.choices.map((choice, index) => {
              let className = 'choice-button';
              let mark = null;
              if (feedback) {
                if (index === feedback.correctIndex) {
                  className += ' is-correct';
                  mark = <CheckIcon />;
                } else if (index === feedback.chosenIndex) {
                  className += ' is-wrong';
                  mark = <CrossIcon />;
                } else {
                  className += ' is-muted';
                }
              }
              return (
                <li key={choice}>
                  <button
                    type="button"
                    className={className}
                    disabled={inputLocked}
                    onClick={() => onSubmit(index)}
                  >
                    <span className="choice-chip">{LETTERS[index]}.</span>
                    <span className="choice-text">{choice}</span>
                    {mark}
                  </button>
                </li>
              );
            })}
          </ul>
        </Plate>
      </div>
    </div>
  );
}
