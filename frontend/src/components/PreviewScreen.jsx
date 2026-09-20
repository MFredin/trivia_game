import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import QuestionCard from './QuestionCard.jsx';
import ResultReveal from './ResultReveal.jsx';
import { answerPreview, startPreview } from '../api/preview.js';

export default function PreviewScreen({ onDone }) {
  const [previewId, setPreviewId] = useState(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [question, setQuestion] = useState(null);
  const [token, setToken] = useState(null);
  const [issuedAt, setIssuedAt] = useState(null);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    startPreview()
      .then((data) => {
        setPreviewId(data.preview_id);
        setQuestionCount(data.question_count);
        setQuestion(data.question);
        setToken(data.token);
        setIssuedAt(data.issued_at);
      })
      .catch(() => setError('Could not load a preview question — try again in a moment.'));
  }, []);

  const handleSubmit = async (chosenIndex) => {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      const result = await answerPreview({
        previewId,
        questionId: question.question_id,
        chosenIndex,
        token,
        issuedAt,
        position: question.position,
      });
      setStreak(result.correct ? streak + 1 : 0);
      if (result.correct) setCorrectCount((c) => c + 1);
      setFeedback({
        correct: result.correct,
        timedOut: result.timed_out,
        correctIndex: question.choices.indexOf(result.correct_answer),
        chosenIndex,
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        sessionComplete: result.session_complete,
        next: result.next,
      });
    } catch {
      setError('Lost connection — your preview ended, but no progress was ever at risk.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (feedback.sessionComplete || !feedback.next) {
      setDone(true);
      return;
    }
    setQuestion(feedback.next.question);
    setToken(feedback.next.token);
    setIssuedAt(feedback.next.issued_at);
    setFeedback(null);
  };

  if (error) {
    return (
      <div>
        <Plate>
          <p className="explanation" style={{ textAlign: 'center' }}>
            {error}
          </p>
        </Plate>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <p className="screen-eyebrow" style={{ textAlign: 'center' }}>
          Guest Preview
        </p>
        <h2 className="screen-title" style={{ textAlign: 'center' }}>
          Taste Concluded
        </h2>
        <Plate>
          <p className="explanation" style={{ textAlign: 'center' }}>
            You got {correctCount} of {questionCount} right. Create a free account to save your progress, join the
            leaderboards, and challenge friends to a duel.
          </p>
        </Plate>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button type="button" className="primary-button" onClick={onDone}>
            Create an account to save your progress
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div>
        <Plate>
          <p className="explanation" style={{ textAlign: 'center' }}>
            Fetching a question&hellip;
          </p>
        </Plate>
      </div>
    );
  }

  return (
    <div>
      <p className="screen-eyebrow" style={{ textAlign: 'center' }}>
        Guest Preview — Question {question.position + 1} of {questionCount}
      </p>
      <QuestionCard
        question={question}
        timeLimitMs={20000}
        issuedAt={issuedAt}
        timingMode="per_question"
        sessionCreatedAt={issuedAt}
        streak={streak}
        strikes={0}
        maxStrikes={null}
        feedback={feedback}
        onSubmit={handleSubmit}
      />
      {feedback && (
        <ResultReveal
          correct={feedback.correct}
          timedOut={feedback.timedOut}
          points={null}
          correctAnswer={feedback.correctAnswer}
          explanation={feedback.explanation}
          isLast={feedback.sessionComplete}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
