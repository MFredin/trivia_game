import { useEffect, useRef, useState } from 'react';
import Plate from './Plate.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];
const FLIP_OUT_MS = 480;
const FLIP_IN_MS = 560;

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

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block' }}>
      <circle cx="7" cy="7.5" r="5.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4.6V7.5L9.1 8.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function QuestionCard({
  question,
  timeLimitMs,
  issuedAt,
  timingMode,
  sessionCreatedAt,
  streak,
  strikes,
  maxStrikes,
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

  useEffect(() => {
    if (question.question_id === displayedQuestion.question_id) return undefined;
    setFlipPhase('out');
    const outTimer = setTimeout(
      () => {
        setDisplayedQuestion(question);
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

  const seconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  const flipClass = flipPhase === 'out' ? 'is-turning-out' : flipPhase === 'in' ? 'is-turning-in' : '';
  const inputLocked = Boolean(feedback) || flipPhase !== 'idle';

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
              <div className="qcard-margin-timer">
                <ClockIcon />
                {mm}:{ss}
              </div>
              <p className="qcard-margin-label">remaining</p>
              <div className="qcard-margin-divider" />
              <div className="qcard-margin-stat">
                <span className="qcard-margin-stat-label">Streak</span>
                <span className="qcard-margin-stat-value">{streak}</span>
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
            </div>
          }
        >
          <p className="question-text">{displayedQuestion.question_text}</p>
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
                    <span className="choice-chip">{LETTERS[index]}</span>
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
