export default function ResultReveal({ correct, timedOut, skipped, points, correctAnswer, explanation, onContinue, isLast }) {
  return (
    <div className={`result-reveal ${correct ? '' : 'is-wrong'}`}>
      {/* A pass is neither right nor wrong, and saying "Incorrect" for a deliberate choice
          would misreport what the player did. */}
      <h2>{skipped ? 'Passed' : timedOut ? "Time's up" : correct ? 'Correct' : 'Incorrect'}</h2>
      {/* Only when the answer actually scored. A miss scores 0, and "0" set in IM Fell's
          oldstyle figures reads as a small ring rather than a digit — but a zero here was
          noise regardless: the verdict, the right answer and the note say everything. */}
      {points > 0 && <div className="points">+{points}</div>}
      {!correct && (
        <p className="explanation">
          The answer was <b>{correctAnswer}</b>
        </p>
      )}
      {skipped && <p className="explanation">Your streak carries on.</p>}
      {explanation && <p className="explanation">{explanation}</p>}
      <button type="button" className="primary-button" onClick={onContinue}>
        {isLast ? 'See results' : 'Next question'}
      </button>
    </div>
  );
}
