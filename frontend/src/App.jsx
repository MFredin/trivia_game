import { useEffect, useRef, useState } from 'react';
import NavBar from './components/NavBar.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import StartScreen from './components/StartScreen.jsx';
import QuestionCard from './components/QuestionCard.jsx';
import ResultReveal from './components/ResultReveal.jsx';
import SessionSummary from './components/SessionSummary.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import FriendsPanel from './components/FriendsPanel.jsx';
import DuelLobbyScreen from './components/DuelLobbyScreen.jsx';
import DuelOpponentStrip from './components/DuelOpponentStrip.jsx';
import DuelSummaryScreen from './components/DuelSummaryScreen.jsx';
import DuelInviteBanner from './components/DuelInviteBanner.jsx';
import AchievementsScreen from './components/AchievementsScreen.jsx';
import AchievementToast from './components/AchievementToast.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import MischiefModal from './components/MischiefModal.jsx';
import SuggestQuestionScreen from './components/SuggestQuestionScreen.jsx';
import AdminSuggestionsScreen from './components/AdminSuggestionsScreen.jsx';
import PreviewScreen from './components/PreviewScreen.jsx';
import ProfileScreen from './components/ProfileScreen.jsx';
import ChallengeScreen from './components/ChallengeScreen.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';
import Embers from './components/Embers.jsx';
import { useDuelSocket } from './hooks/useDuelSocket.js';
import { DEFAULT_HOUSE } from './constants/houses.js';
import {
  acceptDuel,
  createDuel,
  createSession,
  declineDuel,
  getCategories,
  getLeaderboard,
  getMe,
  getPendingDuels,
  startChallenge,
  submitAnswer,
  updateTheme,
} from './api/client.js';

const TOKEN_STORAGE_KEY = 'trivia_auth_token';
const SECRET_PHRASE = 'i solemnly swear that i am up to no good';

export default function App() {
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [categories, setCategories] = useState([]);
  const [screen, setScreen] = useState('auth');
  const [cameFromPreview, setCameFromPreview] = useState(false);
  // A challenge link (?challenge=<code>) should land on that challenge's screen once the
  // visitor is authenticated, whether they arrived already logged in or just registered/logged
  // in through AuthScreen — read once, since the query string doesn't change afterward.
  const [challengeCode] = useState(() => new URLSearchParams(window.location.search).get('challenge'));
  const [showFeedback, setShowFeedback] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileReturnScreen, setProfileReturnScreen] = useState('friends');
  const [startError, setStartError] = useState(null);

  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [token, setToken] = useState(null);
  const [issuedAt, setIssuedAt] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardScope, setLeaderboardScope] = useState('global');
  const [leaderboardWindow, setLeaderboardWindow] = useState('current');

  // --- duels ---
  const [pendingDuels, setPendingDuels] = useState([]);
  const [duelLobbyOpponent, setDuelLobbyOpponent] = useState(null);
  const [outgoingDuel, setOutgoingDuel] = useState(null);
  const [duelLobbyError, setDuelLobbyError] = useState(null);
  const [duelOpponentUsername, setDuelOpponentUsername] = useState(null);
  const [opponentLive, setOpponentLive] = useState(null);
  const [duelResult, setDuelResult] = useState(null);
  const [duelNotice, setDuelNotice] = useState(null);

  // --- achievements ---
  const [achievementQueue, setAchievementQueue] = useState([]);

  // --- Marauder's Map easter egg ---
  const [showMischief, setShowMischief] = useState(false);
  const secretBufferRef = useRef('');

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-house', currentUser?.theme ?? DEFAULT_HOUSE);
  }, [currentUser?.theme]);

  // The desktop half of the easter egg — a passive listener (no preventDefault, so it never
  // interferes with typing anywhere else on the page) watching for the phrase typed anywhere.
  // The mobile-friendly half (tap the wordmark 7 times) lives in NavBar and calls the same
  // setShowMischief handler.
  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key.length !== 1) return;
      secretBufferRef.current = (secretBufferRef.current + event.key).slice(-SECRET_PHRASE.length);
      if (secretBufferRef.current.toLowerCase() === SECRET_PHRASE) {
        secretBufferRef.current = '';
        setShowMischief(true);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
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
        setScreen(challengeCode ? 'challenge' : 'start');
      })
      .catch(() => localStorage.removeItem(TOKEN_STORAGE_KEY))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authToken) return;
    getPendingDuels(authToken)
      .then((data) => setPendingDuels(data.pending))
      .catch(() => {});
  }, [authToken]);

  const handleDuelEvent = (event) => {
    switch (event.type) {
      case 'duel:invited': {
        setPendingDuels((prev) => [
          ...prev.filter((d) => d.duel_id !== event.duel.duel_id),
          { ...event.duel, direction: 'incoming' },
        ]);
        break;
      }
      case 'duel:declined': {
        setPendingDuels((prev) => prev.filter((d) => d.duel_id !== event.duel_id));
        if (outgoingDuel?.duel_id === event.duel_id) {
          setDuelNotice(`${outgoingDuel.opponent_username} declined your challenge.`);
          setOutgoingDuel(null);
        }
        break;
      }
      case 'duel:started': {
        if (outgoingDuel?.duel_id === event.duel_id) {
          setDuelOpponentUsername(outgoingDuel.opponent_username);
          setSession({
            id: event.session_id,
            mode: 'duel',
            category: outgoingDuel.category,
            canonSource: outgoingDuel.canon_source,
            difficulty: outgoingDuel.difficulty,
            timeLimitMs: event.time_limit_ms,
            timingMode: 'per_question',
            maxStrikes: null,
            createdAt: new Date().toISOString(),
          });
          setQuestion(event.question);
          setToken(event.token);
          setIssuedAt(event.issued_at);
          setStreak(0);
          setBestStreak(0);
          setStrikes(0);
          setTotalScore(0);
          setFeedback(null);
          setOpponentLive(null);
          setDuelResult(null);
          setOutgoingDuel(null);
          setScreen('question');
        }
        break;
      }
      case 'duel:opponent_progress': {
        setOpponentLive({
          runningTotal: event.running_total,
          streak: event.streak,
          sessionComplete: event.session_complete,
        });
        break;
      }
      case 'duel:finished': {
        const mine = event.results.find((r) => r.user_id === currentUser?.id);
        const theirs = event.results.find((r) => r.user_id !== currentUser?.id);
        setDuelResult({ yourScore: mine?.total_score ?? 0, opponentScore: theirs?.total_score ?? 0 });
        break;
      }
      case 'achievement:unlocked': {
        setAchievementQueue((prev) => [...prev, event.achievement]);
        break;
      }
      default:
        break;
    }
  };

  useDuelSocket(authToken, handleDuelEvent);

  useEffect(() => {
    if (achievementQueue.length === 0) return undefined;
    const timer = setTimeout(() => setAchievementQueue((prev) => prev.slice(1)), 5000);
    return () => clearTimeout(timer);
  }, [achievementQueue]);

  const handleAuthenticated = (newToken, user) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setAuthToken(newToken);
    setCurrentUser(user);
    setScreen(challengeCode ? 'challenge' : 'start');
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setCurrentUser(null);
    setScreen('auth');
  };

  const handleSelectTheme = async (theme) => {
    setCurrentUser((prev) => ({ ...prev, theme }));
    try {
      await updateTheme(theme, authToken);
    } catch {
      // the DOM already reflects the pick; a failed save just means it won't stick next login
    }
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
        maxStrikes: data.max_strikes,
        createdAt: data.created_at,
      });
      setQuestion(data.question);
      setToken(data.token);
      setIssuedAt(data.issued_at);
      setStreak(0);
      setBestStreak(0);
      setStrikes(0);
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

  const handleStartChallenge = async (code) => {
    const data = await startChallenge(code, authToken);
    setSession({
      id: data.session_id,
      mode: data.mode,
      category: data.category,
      canonSource: data.canon_source,
      difficulty: data.difficulty,
      timeLimitMs: data.time_limit_ms,
      timingMode: data.timing_mode,
      maxStrikes: data.max_strikes,
      createdAt: data.created_at,
    });
    setQuestion(data.question);
    setToken(data.token);
    setIssuedAt(data.issued_at);
    setStreak(0);
    setBestStreak(0);
    setStrikes(0);
    setTotalScore(0);
    setFeedback(null);
    setScreen('question');
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
      setBestStreak(result.session.best_streak);
      setStrikes(result.strikes);
      setTotalScore(result.running_total);
    } catch (err) {
      setStartError('Lost connection to the server — your progress up to this point is saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchLeaderboard = async (scope, window) => {
    const data = await getLeaderboard(
      session.mode,
      { category: session.category, canonSource: session.canonSource, difficulty: session.difficulty, scope, window },
      authToken,
    );
    setLeaderboard(data.entries);
    setLeaderboardScope(scope);
    setLeaderboardWindow(window);
  };

  const handleContinue = async () => {
    if (feedback.sessionComplete) {
      if (session.mode === 'duel') {
        setScreen('duel-summary');
        return;
      }
      await fetchLeaderboard('global', 'current');
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

  const handleChallenge = (username) => {
    setDuelLobbyOpponent(username);
    setOutgoingDuel(null);
    setDuelLobbyError(null);
    setScreen('duel-lobby');
  };

  const handleViewProfile = (username) => {
    setProfileReturnScreen(screen);
    setViewingProfile(username);
    setScreen('profile');
  };

  const handleSendDuel = async ({ category, canonSource, difficulty }) => {
    setDuelLobbyError(null);
    try {
      const data = await createDuel({ opponentUsername: duelLobbyOpponent, category, canonSource, difficulty }, authToken);
      setOutgoingDuel({
        duel_id: data.duel_id,
        opponent_username: data.opponent_username,
        category: data.category,
        canon_source: data.canon_source,
        difficulty: data.difficulty,
      });
    } catch (err) {
      if (err.code === 'user_not_found') setDuelLobbyError('That player could not be found.');
      else setDuelLobbyError('Could not send that challenge.');
    }
  };

  const handleLeaveDuelLobby = () => {
    setScreen('friends');
  };

  const handleAcceptDuel = async (duelId) => {
    const invite = pendingDuels.find((d) => d.duel_id === duelId);
    try {
      const data = await acceptDuel(duelId, authToken);
      setDuelOpponentUsername(invite?.created_by_username ?? null);
      setSession({
        id: data.session_id,
        mode: 'duel',
        category: invite?.category ?? null,
        canonSource: invite?.canon_source ?? 'combined',
        difficulty: invite?.difficulty ?? null,
        timeLimitMs: data.time_limit_ms,
        timingMode: 'per_question',
        maxStrikes: null,
        createdAt: new Date().toISOString(),
      });
      setQuestion(data.question);
      setToken(data.token);
      setIssuedAt(data.issued_at);
      setStreak(0);
      setBestStreak(0);
      setStrikes(0);
      setTotalScore(0);
      setFeedback(null);
      setOpponentLive(null);
      setDuelResult(null);
      setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
      setScreen('question');
    } catch (err) {
      setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
      setStartError('Could not accept that duel — it may no longer be pending.');
    }
  };

  const handleDeclineDuel = async (duelId) => {
    setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
    try {
      await declineDuel(duelId, authToken);
    } catch {
      // already resolved server-side; local list is already updated
    }
  };

  const handleDuelDone = () => {
    setSession(null);
    setQuestion(null);
    setFeedback(null);
    setDuelResult(null);
    setOpponentLive(null);
    setDuelOpponentUsername(null);
    setScreen('friends');
  };

  if (!authChecked) {
    return <div className="app-shell" />;
  }

  const incomingDuelInvites = pendingDuels.filter((d) => d.direction === 'incoming');
  const navActiveScreen =
    screen === 'duel-lobby' || screen === 'duel-summary'
      ? 'friends'
      : screen === 'profile'
        ? profileReturnScreen
        : screen === 'challenge'
          ? 'start'
          : screen;

  return (
    <div className="app-shell">
      <Embers />
      {screen !== 'auth' && screen !== 'preview' && (
        <NavBar
          currentUser={currentUser}
          activeScreen={navActiveScreen}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onSecretFound={() => setShowMischief(true)}
        />
      )}
      {showMischief && (
        <MischiefModal
          onClose={() => setShowMischief(false)}
          onSuggest={() => {
            setShowMischief(false);
            setScreen('suggest');
          }}
        />
      )}
      {screen !== 'auth' && screen !== 'question' && incomingDuelInvites.length > 0 && (
        <DuelInviteBanner invite={incomingDuelInvites[0]} onAccept={handleAcceptDuel} onDecline={handleDeclineDuel} />
      )}
      {duelNotice && (
        <div className="duel-notice-banner" onClick={() => setDuelNotice(null)}>
          {duelNotice}
        </div>
      )}
      <AchievementToast
        achievement={achievementQueue[0]}
        onDismiss={() => setAchievementQueue((prev) => prev.slice(1))}
      />
      {screen === 'auth' && (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          onTryPreview={() => setScreen('preview')}
          startInMode={cameFromPreview ? 'register' : undefined}
        />
      )}
      {screen === 'preview' && (
        <PreviewScreen
          onDone={() => {
            setCameFromPreview(true);
            setScreen('auth');
          }}
        />
      )}
      {screen === 'start' && currentUser && (
        <StartScreen
          categories={categories}
          currentUser={currentUser}
          onStart={handleStart}
          error={startError}
          token={authToken}
        />
      )}
      {screen === 'leaderboard' && <LeaderboardScreen categories={categories} token={authToken} />}
      {screen === 'achievements' && <AchievementsScreen token={authToken} />}
      {screen === 'settings' && (
        <SettingsScreen
          theme={currentUser?.theme ?? DEFAULT_HOUSE}
          onSelectTheme={handleSelectTheme}
          token={authToken}
          onViewOwnProfile={() => handleViewProfile(currentUser.username)}
        />
      )}
      {screen === 'profile' && viewingProfile && (
        <ProfileScreen
          username={viewingProfile}
          token={authToken}
          onBack={() => setScreen(profileReturnScreen)}
        />
      )}
      {screen === 'challenge' && challengeCode && (
        <ChallengeScreen
          code={challengeCode}
          token={authToken}
          onPlay={handleStartChallenge}
          onCancel={() => setScreen('start')}
        />
      )}
      {screen === 'suggest' && <SuggestQuestionScreen categories={categories} token={authToken} />}
      {screen === 'admin-suggestions' && currentUser?.is_admin && (
        <AdminSuggestionsScreen categories={categories} token={authToken} />
      )}
      {screen === 'friends' && (
        <FriendsPanel
          token={authToken}
          pendingDuels={pendingDuels}
          onAcceptDuel={handleAcceptDuel}
          onDeclineDuel={handleDeclineDuel}
          onChallenge={handleChallenge}
          onViewProfile={handleViewProfile}
        />
      )}
      {screen === 'duel-lobby' && (
        <DuelLobbyScreen
          opponentUsername={duelLobbyOpponent}
          categories={categories}
          outgoingDuel={outgoingDuel}
          error={duelLobbyError}
          onSend={handleSendDuel}
          onLeave={handleLeaveDuelLobby}
        />
      )}
      {screen === 'question' && question && (
        <>
          {session.mode === 'duel' && <DuelOpponentStrip opponentUsername={duelOpponentUsername} live={opponentLive} />}
          <QuestionCard
            key={session.id}
            question={question}
            timeLimitMs={session.timeLimitMs}
            issuedAt={issuedAt}
            timingMode={session.timingMode}
            sessionCreatedAt={session.createdAt}
            mode={session.mode}
            streak={streak}
            strikes={strikes}
            maxStrikes={session.maxStrikes}
            totalScore={totalScore}
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
          bestStreak={bestStreak}
          entries={leaderboard}
          scope={leaderboardScope}
          window={leaderboardWindow}
          onScopeChange={(scope) => fetchLeaderboard(scope, leaderboardWindow)}
          onWindowChange={(window) => fetchLeaderboard(leaderboardScope, window)}
          onPlayAgain={handlePlayAgain}
        />
      )}
      {screen === 'duel-summary' && (
        <DuelSummaryScreen
          yourScore={totalScore}
          opponentUsername={duelOpponentUsername}
          result={duelResult}
          onDone={handleDuelDone}
        />
      )}
      <div className="colophon">
        <p>
          An unofficial fan project. Not affiliated with, endorsed, or sponsored by Warner Bros.,
          Pottermore, or J.K. Rowling.
        </p>
        <button type="button" className="colophon-link" onClick={() => setShowFeedback(true)}>
          Submit Feedback
        </button>
      </div>
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} token={authToken} page={screen} />
      )}
    </div>
  );
}
