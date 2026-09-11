import { useEffect, useState } from 'react';
import StartScreen from './components/StartScreen.jsx';
import QuestionCard from './components/QuestionCard.jsx';
import ResultReveal from './components/ResultReveal.jsx';
import SessionSummary from './components/SessionSummary.jsx';
import { createSession, getCategories, getLeaderboard, submitAnswer } from './api/client.js';

export default function App() {
  const [categories, setCategories] = useState([]);
  const [screen, setScreen] = useState('start');
  const [startError, setStartError] = useState(null);

  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [token, setToken] = useState(null);
  const [issuedAt, setIssuedAt] = useState(null);
  const [streak, setStreak] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  const handleStart = async ({ username, mode, category, canonSource }) => {
    setStartError(null);
    try {
      const data = await createSession({ username, mode, category, canonSource });
      setSession({ id: data.session_id, mode: data.mode, timeLimitMs: data.time_limit_ms });
      setQuestion(data.question);
      setToken(data.token);
      setIssuedAt(data.issued_at);
      setStreak(0);
      setTotalScore(0);
      setFeedback(null);
      setScreen('question');
    } catch (err) {
      if (err.code === 'daily_already_played') {
        setStartError("You've already played today's Daily Challenge — come back tomorrow.");
      } else if (err.code === 'no_eligible_questions') {
        setStartError('No questions match that combination yet — try a different category or canon source.');
      } else {
        setStartError('Something went wrong starting the run. Try again.');
      }
    }
  };

  const handleSubmit = async (chosenIndex) => {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      const result = await submitAnswer(session.id, {
        questionId: question.question_id,
        chosenIndex,
        token,
      });
      const correctIndex = question.choices.indexOf(result.correct_answer);
      setFeedback({
        correct: result.correct,
        timedOut: result.timed_out,
        points: result.points,
        correctIndex,
        chosenIndex,
        correctAnswer: result.correct_answer,
        explanation: result.explanation,
        sessionComplete: result.session_complete,
        next: result.next,
      });
      setStreak(result.streak);
      setTotalScore(result.running_total);
    } catch (err) {
      setStartError('Lost connection to the server — your progress up to this point is saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (feedback.sessionComplete) {
      const data = await getLeaderboard(session.mode);
      setLeaderboard(data.entries);
      setScreen('summary');
      return;
    }
    setQuestion(feedback.next.question);
    setToken(feedback.next.token);
    setIssuedAt(feedback.next.issued_at);
    setFeedback(null);
  };

  const handlePlayAgain = () => {
    setSession(null);
    setQuestion(null);
    setFeedback(null);
    setScreen('start');
  };

  return (
    <div className="app-shell">
      <div className="wordmark">The Restricted Section</div>
      {screen === 'start' && (
        <StartScreen categories={categories} onStart={handleStart} error={startError} />
      )}
      {screen === 'question' && question && (
        <>
          <QuestionCard
            question={question}
            timeLimitMs={session.timeLimitMs}
            issuedAt={issuedAt}
            streak={streak}
            feedback={feedback}
            onSubmit={handleSubmit}
          />
          {feedback && (
            <ResultReveal
              correct={feedback.correct}
              timedOut={feedback.timedOut}
              points={feedback.points}
              correctAnswer={feedback.correctAnswer}
              explanation={feedback.explanation}
              isLast={feedback.sessionComplete}
              onContinue={handleContinue}
            />
          )}
        </>
      )}
      {screen === 'summary' && (
        <SessionSummary
          totalScore={totalScore}
          mode={session.mode}
          entries={leaderboard}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
