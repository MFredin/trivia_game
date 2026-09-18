import { useCallback, useEffect, useRef, useState } from 'react';
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
  fetchNextQuestion,
  getCategories,
  getHealth,
  getLeaderboard,
  getMe,
  getPendingDuels,
  getSession,
  startChallenge,
  submitAnswer,
  updateTheme,
} from './api/client.js';

const TOKEN_STORAGE_KEY = 'trivia_auth_token';

// Injected at build time by vite.config.js from Railway's RAILWAY_GIT_COMMIT_SHA. Falls back
// to 'dev' for a local build, which is also how you can tell one at a glance.
const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev';

const SECRET_PHRASE = 'i solemnly swear that i am up to no good';

// A dropped request on a phone is common and usually momentary. Riding out a couple of them
// is the difference between a run that carries on and a run the player has to rescue by hand,
// so transient failures (no response, 5xx, 429) are retried before anything reaches the screen.
// A 4xx is never retried: the server understood and said no, and asking again cannot change it.
const RETRY_DELAYS_MS = [400, 1200];
// Retrying is only worth doing while the player would still rather wait than be told. Past
// this, silence is worse than a message, so whatever went wrong gets reported instead of
// retried again — three hung requests in a row would otherwise mean a minute of "Sending...".
const RETRY_BUDGET_MS = 20000;

async function withRetries(attempt) {
  const startedAt = Date.now();
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      const spent = Date.now() - startedAt;
      if (!err?.transient || i >= RETRY_DELAYS_MS.length || spent > RETRY_BUDGET_MS) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
    }
  }
}

function describeFailure(err, doing) {
  if (err?.code === 'network_unreachable') {
    return err.timedOut ? `The server took too long ${doing}.` : `We couldn't reach the server while ${doing}.`;
  }
  if (err?.status >= 500) return `The server hit an error ${doing}.`;
  if (err?.status === 429) return `The server is busy. It couldn't keep up ${doing}.`;
  return `Something went wrong ${doing}.`;
}

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
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [runCorrectness, setRunCorrectness] = useState([]);
  const [feedback, setFeedback] = useState(null);
  // A ref, not state: the countdown's own timeout submission can fire from a closure that
  // was captured before a state update committed, and would sail straight past a `submitting`
  // state check and post a second answer for the same question.
  const submitLockRef = useRef(false);
  const [submitPending, setSubmitPending] = useState(false);
  // Anything that stops an answer from landing. It is rendered ON THE QUESTION SCREEN — the
  // bug this replaced put it in `startError`, which only the start screen renders, so a failed
  // answer left the player tapping live-looking choices forever with nothing on screen.
  const [answerError, setAnswerError] = useState(null);

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

  // The backend's own commit. Shown beside the frontend's only when they differ, which is
  // exactly the case worth noticing: half a release live.
  const [apiBuild, setApiBuild] = useState(null);

  // --- Marauder's Map easter egg ---
  const [showMischief, setShowMischief] = useState(false);
  const secretBufferRef = useRef('');

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    getHealth()
      .then((data) => setApiBuild(data?.commit ?? null))
      .catch(() => setApiBuild(null));
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
          setCorrectCount(0);
          setAnsweredCount(0);
          setRunCorrectness([]);
          setFeedback(null);
          setAnswerError(null);
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
      setCorrectCount(0);
      setAnsweredCount(0);
      setRunCorrectness([]);
      setFeedback(null);
      setAnswerError(null);
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
    setCorrectCount(0);
    setAnsweredCount(0);
    setRunCorrectness([]);
    setFeedback(null);
    setAnswerError(null);
    setScreen('question');
  };

  // A submission the server already recorded, whose response we never saw. Retrying it can
  // only ever 409 again, so read the run's real state instead of leaving the player stranded
  // on a question that is, as far as the server is concerned, behind them.
  const recoverFromStaleAnswer = async () => {
    try {
      const live = await withRetries(() => getSession(session.id));
      if (live.status === 'completed') {
        setAnswerError(null);
        await finishRun();
        return true;
      }
      // Still running: the answer landed and the next question is ours to ask for.
      const next = await withRetries(() => fetchNextQuestion(session.id));
      setQuestion(next.question);
      setToken(next.token);
      setIssuedAt(next.issued_at);
      setFeedback(null);
      setAnswerError(null);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = useCallback(
    async (chosenIndex) => {
      if (submitLockRef.current || feedback) return;
      submitLockRef.current = true;
      setSubmitPending(true);
      setAnswerError(null);
      try {
        const result = await withRetries(() =>
          submitAnswer(session.id, {
            questionId: question.question_id,
            chosenIndex,
            token,
          }),
        );
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
        });
        setStreak(result.streak);
        setBestStreak(result.session.best_streak);
        setStrikes(result.strikes);
        setTotalScore(result.running_total);
        setAnsweredCount((n) => n + 1);
        if (result.correct) setCorrectCount((n) => n + 1);
        setRunCorrectness((arr) => [...arr, result.correct]);
      } catch (err) {
        if (err.code === 'already_answered' || err.code === 'session_not_active') {
          const recovered = await recoverFromStaleAnswer();
          if (recovered) return;
          setAnswerError({
            message: 'That answer already reached us, but we lost the reply. Your run is safe.',
            retryable: false,
          });
          return;
        }
        setAnswerError({
          message: describeFailure(err, chosenIndex === -1 ? 'recording your timeout' : 'recording that answer'),
          retryable: true,
          chosenIndex,
        });
      } finally {
        submitLockRef.current = false;
        setSubmitPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, question?.question_id, token, feedback],
  );

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

  // The run is over on the server; get the player to their result. The leaderboard is a
  // courtesy here, so a failure to load it must never be what stands between a finished run
  // and its summary — that was the other way this screen could dead-end.
  const finishRun = async () => {
    if (session.mode === 'duel') {
      setScreen('duel-summary');
      return;
    }
    try {
      await fetchLeaderboard('global', 'current');
    } catch {
      setLeaderboard([]);
    }
    setScreen('summary');
  };

  const handleContinue = async () => {
    if (feedback.sessionComplete) {
      setAnswerError(null);
      await finishRun();
      return;
    }
    // Asking for the next question is what starts its clock, so it happens here — when the
    // player has finished reading and is ready — not back when they submitted the last answer.
    setAnswerError(null);
    setSubmitPending(true);
    try {
      const next = await withRetries(() => fetchNextQuestion(session.id));
      setQuestion(next.question);
      setToken(next.token);
      setIssuedAt(next.issued_at);
      setFeedback(null);
    } catch (err) {
      if (err.code === 'session_not_active') {
        await finishRun();
        return;
      }
      setAnswerError({
        message: describeFailure(err, 'loading the next question'),
        retryable: true,
        continueInstead: true,
      });
    } finally {
      setSubmitPending(false);
    }
  };

  const handleRetryAnswer = () => {
    if (!answerError?.retryable) return;
    if (answerError.continueInstead) {
      handleContinue();
      return;
    }
    handleSubmit(answerError.chosenIndex);
  };

  const handleAbandonRun = () => {
    setAnswerError(null);
    setSession(null);
    setQuestion(null);
    setFeedback(null);
    setScreen('start');
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
      setCorrectCount(0);
      setAnsweredCount(0);
      setRunCorrectness([]);
      setFeedback(null);
      setAnswerError(null);
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
            submitPending={submitPending}
            onSubmit={handleSubmit}
          />
          {answerError && (
            <div className="answer-error" role="alert">
              <p className="answer-error-message">{answerError.message}</p>
              <div className="answer-error-actions">
                {answerError.retryable && (
                  <button type="button" className="primary-button" onClick={handleRetryAnswer} disabled={submitPending}>
                    {submitPending ? 'Trying…' : 'Try again'}
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={handleAbandonRun}>
                  Leave this run
                </button>
              </div>
            </div>
          )}
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
          correctCount={correctCount}
          answeredCount={answeredCount}
          runCorrectness={runCorrectness}
          house={currentUser?.theme ?? DEFAULT_HOUSE}
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
          house={currentUser?.theme ?? DEFAULT_HOUSE}
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
        {/* Which build a player is actually looking at. Worth the seven characters: without
            it, confirming a deploy reached the browser means diffing bundle hashes. */}
        <p className="colophon-build" title={`frontend build ${BUILD_COMMIT}`}>
          Set from <span>{BUILD_COMMIT}</span>
          {apiBuild && apiBuild !== BUILD_COMMIT && <span> · api {apiBuild}</span>}
        </p>
      </div>
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} token={authToken} page={screen} />
      )}
    </div>
  );
}
