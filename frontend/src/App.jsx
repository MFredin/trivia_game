import { useEffect, useState } from 'react';
import NavBar from './components/NavBar.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import StartScreen from './components/StartScreen.jsx';
import QuestionCard from './components/QuestionCard.jsx';
import ResultReveal from './components/ResultReveal.jsx';
import SessionSummary from './components/SessionSummary.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import FriendsPanel from './components/FriendsPanel.jsx';
import { createSession, getCategories, getLeaderboard, getMe, submitAnswer } from './api/client.js';

const TOKEN_STORAGE_KEY = 'trivia_auth_token';

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [categories, setCategories] = useState([]);
  const [screen, setScreen] = useState('auth');
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
  const [leaderboardScope, setLeaderboardScope] = useState('global');

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setAuthChecked(true);
      return;
    }
    getMe(stored)
      .then((data) => {
        setAuthToken(stored);
        setCurrentUser(data.user);
        setScreen('start');
      })
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleAuthenticated = (newToken, user) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setAuthToken(newToken);
    setCurrentUser(user);
    setScreen('start');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setCurrentUser(null);
    setScreen('auth');
  };

  const handleNavigate = (target) => {
    setStartError(null);
    setScreen(target);
  };

  const handleStart = async ({ mode, category, canonSource, difficulty }) => {
    setStartError(null);
    try {
      const data = await createSession({ mode, category, canonSource, difficulty }, authToken);
      setSession({
        id: data.session_id,
        mode: data.mode,
        category: data.category,
        canonSource: data.canon_source,
        difficulty: data.difficulty,
        timeLimitMs: data.time_limit_ms,
        timingMode: data.timing_mode,
        endOnFirstMiss: data.end_on_first_miss,
        createdAt: data.created_at,
      });
      setQuestion(data.question);
      setToken(data.token);
      setIssuedAt(data.issued_at);
      setStreak(0);
      setTotalScore(0);
      setFeedback(null);
      setScreen('question');
    } catch (err) {
      if (err.code === 'unauthorized') {
        handleLogout();
      } else if (err.code === 'daily_already_played') {
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

  const fetchLeaderboard = async (scope) => {
    const data = await getLeaderboard(
      session.mode,
      { category: session.category, canonSource: session.canonSource, difficulty: session.difficulty, scope },
      authToken,
    );
    setLeaderboard(data.entries);
    setLeaderboardScope(scope);
  };

  const handleContinue = async () => {
    if (feedback.sessionComplete) {
      await fetchLeaderboard('global');
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

  if (!authChecked) {
    return <div className="app-shell" />;
  }

  return (
    <div className="app-shell">
      {screen !== 'auth' && (
        <NavBar currentUser={currentUser} activeScreen={screen} onNavigate={handleNavigate} onLogout={handleLogout} />
      )}
      {screen === 'auth' && <AuthScreen onAuthenticated={handleAuthenticated} />}
      {screen === 'start' && currentUser && (
        <StartScreen categories={categories} currentUser={currentUser} onStart={handleStart} error={startError} />
      )}
      {screen === 'leaderboard' && <LeaderboardScreen categories={categories} token={authToken} />}
      {screen === 'friends' && <FriendsPanel token={authToken} />}
      {screen === 'question' && question && (
        <>
          <QuestionCard
            question={question}
            timeLimitMs={session.timeLimitMs}
            issuedAt={issuedAt}
            timingMode={session.timingMode}
            sessionCreatedAt={session.createdAt}
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
          category={session.category}
          canonSource={session.canonSource}
          difficulty={session.difficulty}
          entries={leaderboard}
          scope={leaderboardScope}
          onScopeChange={fetchLeaderboard}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
