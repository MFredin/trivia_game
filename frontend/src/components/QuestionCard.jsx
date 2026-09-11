import { useEffect, useRef, useState } from 'react';
import Plate from './Plate.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

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

export default function QuestionCard({
  question,
  timeLimitMs,
  issuedAt,
  timingMode,
  sessionCreatedAt,
  streak,
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

  const seconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div>
      <div className="catalog-tabs">
        <div className="catalog-tab">{question.obscurity_tier}</div>
        <div className="catalog-tab">{question.category}</div>
        {question.divergence && <div className="catalog-tab catalog-tab--divergence">Divergence</div>}
      </div>
      <Plate className="plate--tabbed" noGilt>
        <p className="question-text">{question.question_text}</p>
        <ul className="choice-list">
          {question.choices.map((choice, index) => {
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
                  disabled={Boolean(feedback)}
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
        <div className="hud-row">
          <span>
            <svg
              className="hud-icon"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ display: 'inline-block' }}
            >
              <circle cx="7" cy="7.5" r="5.6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.6V7.5L9.1 8.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {mm}:{ss}
          </span>
          <span className="streak">streak: {streak}</span>
        </div>
      </Plate>
    </div>
  );
}
