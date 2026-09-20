import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import NavBar from './components/NavBar.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import StartScreen from './components/StartScreen.jsx';
import QuestionCard from './components/QuestionCard.jsx';
import ResultReveal from './components/ResultReveal.jsx';
import SessionSummary from './components/SessionSummary.jsx';
import DuelOpponentStrip from './components/DuelOpponentStrip.jsx';
import DuelInviteBanner from './components/DuelInviteBanner.jsx';
import AchievementToast from './components/AchievementToast.jsx';
import Embers from './components/Embers.jsx';
import { useAuth } from './features/auth/useAuth.js';
import { useRun } from './features/run/useRun.js';
import { useDuels } from './features/duels/useDuels.js';
import { useLeaderboard } from './features/leaderboard/useLeaderboard.js';
import { useAchievementToasts } from './features/achievements/useAchievementToasts.js';
import { useSecretPhrase } from './hooks/useSecretPhrase.js';
import { DEFAULT_HOUSE } from './constants/houses.js';
import { getCategories } from './api/catalog.js';
import { startChallenge } from './api/challenges.js';
import { getHealth } from './api/health.js';
import { createSession } from './api/sessions.js';

// Fetched on demand. All of this used to sit in the first bundle, so every player on a phone
// downloaded the admin review queue, the suggestion form, the whole Friends panel and the
// guest preview before they could read question one — and paid for it again on every release,
// because one file means one cache key. Nothing here is on the path to playing a quiz.
const LeaderboardScreen = lazy(() => import('./components/LeaderboardScreen.jsx'));
const FriendsPanel = lazy(() => import('./components/FriendsPanel.jsx'));
const DuelLobbyScreen = lazy(() => import('./components/DuelLobbyScreen.jsx'));
const DuelSummaryScreen = lazy(() => import('./components/DuelSummaryScreen.jsx'));
const AchievementsScreen = lazy(() => import('./components/AchievementsScreen.jsx'));
const SettingsScreen = lazy(() => import('./components/SettingsScreen.jsx'));
const MischiefModal = lazy(() => import('./components/MischiefModal.jsx'));
const SuggestQuestionScreen = lazy(() => import('./components/SuggestQuestionScreen.jsx'));
const AdminSuggestionsScreen = lazy(() => import('./components/AdminSuggestionsScreen.jsx'));
const PreviewScreen = lazy(() => import('./components/PreviewScreen.jsx'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen.jsx'));
const ChallengeScreen = lazy(() => import('./components/ChallengeScreen.jsx'));
const FeedbackModal = lazy(() => import('./components/FeedbackModal.jsx'));

// Each deferred screen gets its own Suspense boundary rather than one around the whole shell,
// so fetching a chunk never blanks the nav bar or a run already in progress. Modals fall back
// to nothing at all: a placeholder where a dialog is about to appear reads as a glitch.
const screenFallback = <p className="screen-loading">Fetching&hellip;</p>;

// Injected at build time by vite.config.js from Railway's RAILWAY_GIT_COMMIT_SHA. Falls back
// to 'dev' for a local build, which is also how you can tell one at a glance.
const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev';

const SECRET_PHRASE = 'i solemnly swear that i am up to no good';

/**
 * The shell: which screen is showing, and the wiring between the feature hooks.
 *
 * This component used to hold every feature's state — thirty-odd `useState` calls across auth,
 * the run, duels and the leaderboard, and four hand-written copies of the same "reset the run"
 * block. Each feature now owns its state in a hook under `features/`, and what is left here is
 * routing and composition. See ARCHITECTURE.md.
 */
export default function App() {
  const [screen, setScreen] = useState('auth');
  const [categories, setCategories] = useState([]);
  const [cameFromPreview, setCameFromPreview] = useState(false);
  // A challenge link (?challenge=<code>) should land on that challenge's screen once the
  // visitor is authenticated, whether they arrived already logged in or just registered
  // through AuthScreen — read once, since the query string doesn't change afterward.
  // Settable as well as read: the featured weekly challenge opens the same screen a shared
  // link does, just without the round trip through the URL.
  const [challengeCode, setChallengeCode] = useState(() => new URLSearchParams(window.location.search).get('challenge'));
  const [showFeedback, setShowFeedback] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileReturnScreen, setProfileReturnScreen] = useState('friends');
  const [startError, setStartError] = useState(null);
  const [apiBuild, setApiBuild] = useState(null);
  const [showMischief, setShowMischief] = useState(false);

  const auth = useAuth({
    onAuthenticated: useCallback(() => setScreen(challengeCode ? 'challenge' : 'start'), [challengeCode]),
    onLoggedOut: useCallback(() => setScreen('auth'), []),
  });

  const leaderboard = useLeaderboard({ authToken: auth.token });
  const toasts = useAchievementToasts();

  // The run is over on the server; get the player to their result. The leaderboard is a
  // courtesy here, so a failure to load it must never be what stands between a finished run
  // and its summary — that was one of the two ways this screen could dead-end.
  const finishRun = useCallback(
    async (session) => {
      if (session.mode === 'duel') {
        setScreen('duel-summary');
        return;
      }
      try {
        await leaderboard.load(session, 'global', 'current');
      } catch {
        leaderboard.clear();
      }
      setScreen('summary');
    },
    [leaderboard.load, leaderboard.clear],
  );

  const run = useRun({ authToken: auth.token, onComplete: finishRun });
  const duels = useDuels({
    authToken: auth.token,
    currentUser: auth.user,
    run,
    onScreen: setScreen,
    onStartError: setStartError,
    onAchievement: toasts.push,
  });

  useSecretPhrase(SECRET_PHRASE, useCallback(() => setShowMischief(true), []));

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

  const startRun = async ({ mode, category, canonSource, difficulty }) => {
    setStartError(null);
    try {
      const data = await createSession({ mode, category, canonSource, difficulty }, auth.token);
      run.begin({
        session: {
          id: data.session_id,
          mode: data.mode,
          category: data.category,
          canonSource: data.canon_source,
          difficulty: data.difficulty,
          timeLimitMs: data.time_limit_ms,
          timingMode: data.timing_mode,
          maxStrikes: data.max_strikes,
          createdAt: data.created_at,
          lifelinesEnabled: Boolean(data.lifelines_enabled),
        },
        question: data.question,
        token: data.token,
        issuedAt: data.issued_at,
      });
      setScreen('question');
    } catch (err) {
      if (err.code === 'unauthorized') {
        auth.logout();
      } else if (err.code === 'daily_already_played') {
        setStartError("You've already played today's Daily Challenge — come back tomorrow.");
      } else if (err.code === 'no_eligible_questions') {
        setStartError('No questions match that combination yet — try a different category or canon source.');
      } else {
        setStartError('Something went wrong starting the run. Try again.');
      }
    }
  };

  const startChallengeRun = async (code) => {
    const data = await startChallenge(code, auth.token);
    run.begin({
      session: {
        id: data.session_id,
        mode: data.mode,
        category: data.category,
        canonSource: data.canon_source,
        difficulty: data.difficulty,
        timeLimitMs: data.time_limit_ms,
        timingMode: data.timing_mode,
        maxStrikes: data.max_strikes,
        createdAt: data.created_at,
      },
      question: data.question,
      token: data.token,
      issuedAt: data.issued_at,
    });
    setScreen('question');
  };

  const leaveRun = () => {
    run.clear();
    setScreen('start');
  };

  const openChallenge = (code) => {
    setChallengeCode(code);
    setStartError(null);
    setScreen('challenge');
  };

  const navigate = (target) => {
    setStartError(null);
    setScreen(target);
  };

  const viewProfile = (username) => {
    setProfileReturnScreen(screen);
    setViewingProfile(username);
    setScreen('profile');
  };

  if (!auth.checked) {
    return <div className="app-shell" />;
  }

  const { session, question, feedback, answerError } = run;
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
          currentUser={auth.user}
          activeScreen={navActiveScreen}
          onNavigate={navigate}
          onLogout={auth.logout}
          onSecretFound={() => setShowMischief(true)}
        />
      )}
      {showMischief && (
        <Suspense fallback={null}>
          <MischiefModal
            onClose={() => setShowMischief(false)}
            onSuggest={() => {
              setShowMischief(false);
              setScreen('suggest');
            }}
          />
        </Suspense>
      )}
      {screen !== 'auth' && screen !== 'question' && duels.incomingInvites.length > 0 && (
        <DuelInviteBanner invite={duels.incomingInvites[0]} onAccept={duels.accept} onDecline={duels.decline} />
      )}
      {duels.notice && (
        <div className="duel-notice-banner" onClick={duels.dismissNotice}>
          {duels.notice}
        </div>
      )}
      <AchievementToast achievement={toasts.current} onDismiss={toasts.dismiss} />
      {screen === 'auth' && (
        <AuthScreen
          onAuthenticated={auth.authenticate}
          onTryPreview={() => setScreen('preview')}
          startInMode={cameFromPreview ? 'register' : undefined}
        />
      )}
      {screen === 'preview' && (
        <Suspense fallback={screenFallback}>
          <PreviewScreen
            onDone={() => {
              setCameFromPreview(true);
              setScreen('auth');
            }}
          />
        </Suspense>
      )}
      {screen === 'start' && auth.user && (
        <StartScreen
          categories={categories}
          currentUser={auth.user}
          onStart={startRun}
          error={startError}
          token={auth.token}
          onOpenChallenge={openChallenge}
        />
      )}
      {screen === 'leaderboard' && (
        <Suspense fallback={screenFallback}>
          <LeaderboardScreen categories={categories} token={auth.token} />
        </Suspense>
      )}
      {screen === 'achievements' && (
        <Suspense fallback={screenFallback}>
          <AchievementsScreen token={auth.token} />
        </Suspense>
      )}
      {screen === 'settings' && (
        <Suspense fallback={screenFallback}>
          <SettingsScreen
            theme={auth.user?.theme ?? DEFAULT_HOUSE}
            onSelectTheme={auth.selectTheme}
            token={auth.token}
            onViewOwnProfile={() => viewProfile(auth.user.username)}
          />
        </Suspense>
      )}
      {screen === 'profile' && viewingProfile && (
        <Suspense fallback={screenFallback}>
          <ProfileScreen
            username={viewingProfile}
            token={auth.token}
            onBack={() => setScreen(profileReturnScreen)}
          />
        </Suspense>
      )}
      {screen === 'challenge' && challengeCode && (
        <Suspense fallback={screenFallback}>
          <ChallengeScreen
            code={challengeCode}
            token={auth.token}
            onPlay={startChallengeRun}
            onCancel={() => setScreen('start')}
          />
        </Suspense>
      )}
      {screen === 'suggest' && (
        <Suspense fallback={screenFallback}>
          <SuggestQuestionScreen categories={categories} token={auth.token} />
        </Suspense>
      )}
      {screen === 'admin-suggestions' && auth.user?.is_admin && (
        <Suspense fallback={screenFallback}>
          <AdminSuggestionsScreen categories={categories} token={auth.token} />
        </Suspense>
      )}
      {screen === 'friends' && (
        <Suspense fallback={screenFallback}>
          <FriendsPanel
            token={auth.token}
            pendingDuels={duels.pendingDuels}
            onAcceptDuel={duels.accept}
            onDeclineDuel={duels.decline}
            onChallenge={duels.openLobby}
            onViewProfile={viewProfile}
          />
        </Suspense>
      )}
      {screen === 'duel-lobby' && (
        <Suspense fallback={screenFallback}>
          <DuelLobbyScreen
            opponentUsername={duels.lobbyOpponent}
            categories={categories}
            outgoingDuel={duels.outgoing}
            error={duels.lobbyError}
            onSend={duels.invite}
            onLeave={duels.leaveLobby}
          />
        </Suspense>
      )}
      {screen === 'question' && question && (
        <>
          {session.mode === 'duel' && (
            <DuelOpponentStrip
              opponentUsername={duels.opponentUsername}
              live={duels.opponentLive}
              incomingReaction={duels.reaction}
              onReact={duels.react}
            />
          )}
          <QuestionCard
            key={session.id}
            question={question}
            timeLimitMs={session.timeLimitMs}
            issuedAt={run.issuedAt}
            timingMode={session.timingMode}
            sessionCreatedAt={session.createdAt}
            mode={session.mode}
            streak={run.streak}
            strikes={run.strikes}
            maxStrikes={session.maxStrikes}
            totalScore={run.totalScore}
            feedback={feedback}
            submitPending={run.submitPending}
            lifelinesEnabled={session.lifelinesEnabled}
            lifelinesUsed={run.lifelinesUsed}
            hiddenChoices={run.hiddenChoices}
            onFiftyFifty={run.fiftyFifty}
            onSkip={run.skip}
            onSubmit={run.submit}
          />
          {answerError && (
            <div className="answer-error" role="alert">
              <p className="answer-error-message">{answerError.message}</p>
              <div className="answer-error-actions">
                {answerError.retryable && (
                  <button type="button" className="primary-button" onClick={run.retry} disabled={run.submitPending}>
                    {run.submitPending ? 'Trying…' : 'Try again'}
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={leaveRun}>
                  Leave this run
                </button>
              </div>
            </div>
          )}
          {feedback && (
            <ResultReveal
              correct={feedback.correct}
              timedOut={feedback.timedOut}
              skipped={feedback.skipped}
              points={feedback.points}
              correctAnswer={feedback.correctAnswer}
              explanation={feedback.explanation}
              isLast={feedback.sessionComplete}
              onContinue={run.continueToNext}
            />
          )}
        </>
      )}
      {screen === 'summary' && (
        <SessionSummary
          totalScore={run.totalScore}
          mode={session.mode}
          category={session.category}
          canonSource={session.canonSource}
          difficulty={session.difficulty}
          bestStreak={run.bestStreak}
          correctCount={run.correctCount}
          answeredCount={run.answeredCount}
          runCorrectness={run.runCorrectness}
          house={auth.user?.theme ?? DEFAULT_HOUSE}
          entries={leaderboard.entries}
          scope={leaderboard.scope}
          window={leaderboard.window}
          onScopeChange={(scope) => leaderboard.load(session, scope, leaderboard.window)}
          onWindowChange={(window) => leaderboard.load(session, leaderboard.scope, window)}
          onPlayAgain={leaveRun}
        />
      )}
      {screen === 'duel-summary' && (
        <Suspense fallback={screenFallback}>
          <DuelSummaryScreen
            yourScore={run.totalScore}
            opponentUsername={duels.opponentUsername}
            result={duels.result}
            house={auth.user?.theme ?? DEFAULT_HOUSE}
            onDone={duels.done}
          />
        </Suspense>
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
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => setShowFeedback(false)} token={auth.token} page={screen} />
        </Suspense>
      )}
    </div>
  );
}
