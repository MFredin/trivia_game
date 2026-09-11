import { useEffect, useRef, useState } from 'react';
import Tag from './Tag.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

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
    <div className="question-card">
      <div className="tag-row">
        <Tag>{question.obscurity_tier}</Tag>
        <Tag>{question.category}</Tag>
        {question.divergence && <Tag variant="divergence">Divergence</Tag>}
      </div>
      <p className="question-text">{question.question_text}</p>
      <ul className="choice-list">
        {question.choices.map((choice, index) => {
          let className = 'choice-button';
          if (feedback) {
            if (index === feedback.correctIndex) className += ' is-correct';
            else if (index === feedback.chosenIndex && index !== feedback.correctIndex) {
              className += ' is-wrong';
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
                <span className="choice-letter">{LETTERS[index]}</span>
                <span>{choice}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hud-row">
        <span>
          ⧗ {mm}:{ss}
        </span>
        <span className="streak">streak: {streak}</span>
      </div>
    </div>
  );
}
