export default function ResultReveal({ correct, timedOut, points, correctAnswer, explanation, onContinue, isLast }) {
  return (
    <div className={`result-reveal ${correct ? '' : 'is-wrong'}`}>
      <h2>{timedOut ? "Time's up" : correct ? 'Correct' : 'Incorrect'}</h2>
      <div className="points">
        {correct ? '+' : ''}
        {points}
      </div>
      {!correct && <p>The answer was: {correctAnswer}</p>}
      {explanation && <p className="explanation">{explanation}</p>}
      <button type="button" className="primary-button" onClick={onContinue}>
        {isLast ? 'See results' : 'Next question'}
      </button>
    </div>
  );
}
