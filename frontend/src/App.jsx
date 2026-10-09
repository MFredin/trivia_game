import { lazy, Suspense, useCallback, useEffect, useReducer } from 'react';
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
import { useAccount } from './features/account/useAccount.js';
import { useProfile } from './features/social/useProfile.js';
import { useSafety } from './features/safety/useSafety.js';
import { useProfileEditor } from './features/profile/useProfileEditor.js';
import { useModerationNotices } from './features/moderation/useModerationNotices.js';
import { useOwlPost } from './features/owlpost/useOwlPost.js';
import { useHoliday } from './features/holiday/useHoliday.js';
import { useHolidayBats } from './features/holiday/useHolidayBats.js';
import { HolidayContext } from './features/holiday/holidayContext.js';
import HolidayOverlay from './components/HolidayOverlay.jsx';
import HolidayFoot from './components/HolidayFoot.jsx';
import HolidayBats from './components/HolidayBats.jsx';
import { restrictionMessage } from './features/moderation/restrictionMessage.js';
import ModerationNoticeModal from './components/ModerationNoticeModal.jsx';
import RenameModal from './components/RenameModal.jsx';
import { useSecretPhrase } from './hooks/useSecretPhrase.js';
import { DEFAULT_HOUSE } from './constants/houses.js';
import { getCategories } from './api/catalog.js';
import { startChallenge } from './api/challenges.js';
import { playTournamentMatch } from './api/tournaments.js';
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
const EditProfileScreen = lazy(() => import('./components/EditProfileScreen.jsx'));
const OwlPostScreen = lazy(() => import('./components/OwlPostScreen.jsx'));
const MischiefModal = lazy(() => import('./components/MischiefModal.jsx'));
const SuggestQuestionScreen = lazy(() => import('./components/SuggestQuestionScreen.jsx'));
const AdminSuggestionsScreen = lazy(() => import('./components/AdminSuggestionsScreen.jsx'));
const AdminReportsScreen = lazy(() => import('./components/AdminReportsScreen.jsx'));
const AdminTitlesScreen = lazy(() => import('./components/AdminTitlesScreen.jsx'));
const AdminTeamScreen = lazy(() => import('./components/AdminTeamScreen.jsx'));
const RecoveryScreen = lazy(() => import('./components/RecoveryScreen.jsx'));
const PreviewScreen = lazy(() => import('./components/PreviewScreen.jsx'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen.jsx'));
const ChallengeScreen = lazy(() => import('./components/ChallengeScreen.jsx'));
const TournamentScreen = lazy(() => import('./components/TournamentScreen.jsx'));
const FeedbackModal = lazy(() => import('./components/FeedbackModal.jsx'));

// Each deferred screen gets its own Suspense boundary rather than one around the whole shell,
// so fetching a chunk never blanks the nav bar or a run already in progress. Modals fall back
// to nothing at all: a placeholder where a dialog is about to appear reads as a glitch.
const screenFallback = <p className="screen-loading">Fetching&hellip;</p>;

const SECRET_PHRASE = 'i solemnly swear that i am up to no good';

// The shell's own state — everything that is not a feature's, kept out of `features/` per
// ARCHITECTURE.md. Every name here is a field of the reducer state below, not a `useState`.
// A link from an email (?reset=<token> or ?delete=<token>) opens its page. The token is taken out of the
// address bar at once, so it does not sit in the history or travel in a Referer header.
function readRecoveryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const reset = params.get('reset');
  const del = params.get('delete');
  const kind = reset ? 'reset' : del ? 'deletion-confirm' : params.has('delete-account') ? 'deletion-info' : null;
  if (!kind) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return { kind, token: reset ?? del ?? null };
}
const initialRecovery = readRecoveryFromUrl();

const initialAppState = {
  recovery: initialRecovery,
  screen: initialRecovery ? 'recovery' : 'auth',
  categories: [],
  cameFromPreview: false,
  // A challenge link (?challenge=<code>) should land on that challenge's screen once the
  // visitor is authenticated, whether they arrived already logged in or just registered
  // through AuthScreen — read once, since the query string doesn't change afterward.
  challengeCode: new URLSearchParams(window.location.search).get('challenge'),
  // The tournament open on its screen, by code.
  tournamentCode: null,
  showFeedback: false,
  viewingProfile: null,
  profileReturnScreen: 'friends',
  // Profiles opened from other profiles (a friend's chip), so Back walks back through them
  // rather than returning to the profile you are already on.
  profileHistory: [],
  // A one-line message from something that just happened elsewhere (a block made on a profile
  // that has since closed), shown until it is clicked away.
  notice: null,
  // The Owl Post conversation open on that screen, if any (null is the inbox).
  owlWith: null,
  startError: null,
  showMischief: false,
};

/**
 * The shell's state machine: every way `screen` (and the handful of fields that travel with
 * it) can change, named for the event that caused it rather than for the field it touches.
 *
 * This used to be a pile of independent `useState` calls, which let `screen` change a tick
 * away from the data a screen needs (a challenge code, a profile to return to) rather than
 * with it. Each action below is one of those transitions, made atomic and — because they are
 * now named and switched on in one place — traceable.
 */
function appReducer(state, action) {
  switch (action.type) {
    // A stored token checked out, or AuthScreen just registered/logged someone in. A pending
    // challenge link wins over the ordinary start screen.
    case 'auth/authenticated':
      // A recovery page opened from an email stays open for someone who happens to be signed in.
      if (state.screen === 'recovery') return state;
      return { ...state, screen: state.challengeCode ? 'challenge' : 'start' };
    case 'auth/logged_out':
      return { ...state, screen: 'auth' };
    case 'recovery/opened':
      return { ...state, recovery: { kind: action.kind, token: null }, screen: 'recovery' };
    case 'recovery/closed':
      return { ...state, recovery: null, screen: action.signedIn ? 'start' : 'auth' };
    // The run finished on the server; `finishRun` has already tried to load the leaderboard
    // (or decided a duel doesn't get one) before this fires.
    case 'run/finished':
      return { ...state, screen: action.mode === 'duel' ? 'duel-summary' : 'summary' };
    case 'categories/loaded':
      return { ...state, categories: action.categories };
    case 'run/start_requested':
      return { ...state, startError: null };
    case 'run/start_succeeded':
      return { ...state, screen: 'question' };
    case 'run/start_failed':
      return { ...state, startError: action.message };
    case 'challenge/started':
      return { ...state, screen: 'question' };
    case 'run/left':
      return { ...state, screen: 'start' };
    case 'challenge/opened':
      return { ...state, challengeCode: action.code, startError: null, screen: 'challenge' };
    case 'navigated':
      return { ...state, startError: null, screen: action.screen };
    case 'profile/viewed':
      if (state.screen === 'profile') {
        return { ...state, profileHistory: [...state.profileHistory, state.viewingProfile], viewingProfile: action.username };
      }
      return { ...state, profileReturnScreen: state.screen, profileHistory: [], viewingProfile: action.username, screen: 'profile' };
    case 'profile/closed':
      if (state.profileHistory.length > 0) {
        return {
          ...state,
          viewingProfile: state.profileHistory[state.profileHistory.length - 1],
          profileHistory: state.profileHistory.slice(0, -1),
        };
      }
      return { ...state, screen: state.profileReturnScreen };
    case 'owlpost/opened':
      return { ...state, screen: 'owl-post', owlWith: action.username ?? null, startError: null };
    case 'owlpost/closed':
      return { ...state, owlWith: null };
    case 'notice/shown':
      return { ...state, notice: action.message };
    case 'notice/dismissed':
      return { ...state, notice: null };
    case 'preview/entered':
      return { ...state, screen: 'preview' };
    case 'preview/done':
      return { ...state, cameFromPreview: true, screen: 'auth' };
    case 'challenge/canceled':
      return { ...state, screen: 'start' };
    // A tournament match is played as an ordinary run and then returns to the tournament, not to a summary: its score belongs
    // inside the tournament, never on a leaderboard.
    case 'tournament/opened':
      return { ...state, tournamentCode: action.code, startError: null, screen: 'tournament' };
    case 'tournament/closed':
      return { ...state, screen: 'friends' };
    case 'tournament/match_started':
      return { ...state, screen: 'question' };
    case 'tournament/run_finished':
      return { ...state, screen: 'tournament' };
    case 'mischief/opened':
      return { ...state, showMischief: true };
    case 'mischief/closed':
      return { ...state, showMischief: false };
    case 'mischief/suggest_opened':
      return { ...state, showMischief: false, screen: 'suggest' };
    case 'feedback/opened':
      return { ...state, showFeedback: true };
    case 'feedback/closed':
      return { ...state, showFeedback: false };
    // `useDuels` is handed generic callbacks — it does not know screen names or error copy —
    // so these two stay as a change-of-screen and a message, not a semantic event.
    case 'duels/screen_changed':
      return { ...state, screen: action.screen };
    case 'duels/start_error':
      return { ...state, startError: action.message };
    default:
      return state;
  }
}

/**
 * The shell: which screen is showing, and the wiring between the feature hooks.
 *
 * This component used to hold every feature's state — thirty-odd `useState` calls across auth,
 * the run, duels and the leaderboard, and four hand-written copies of the same "reset the run"
 * block. Each feature now owns its state in a hook under `features/`, and what is left here —
 * routing and composition, per ARCHITECTURE.md — is one `useReducer` rather than a dozen
 * `useState`s that could change out of step with each other.
 */
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const {
    screen,
    recovery,
    categories,
    cameFromPreview,
    challengeCode,
    tournamentCode,
    showFeedback,
    viewingProfile,
    profileReturnScreen,
    startError,
    showMischief,
    notice,
    owlWith,
  } = state;

  // Stable identities for the two callbacks `useDuels` calls directly (a socket event can fire
  // between renders), the same way the `useState` setters they replace were already stable.
  const dispatchScreen = useCallback((target) => dispatch({ type: 'duels/screen_changed', screen: target }), []);
  const dispatchStartError = useCallback((message) => dispatch({ type: 'duels/start_error', message }), []);

  const auth = useAuth({
    onAuthenticated: useCallback(() => dispatch({ type: 'auth/authenticated' }), []),
    onLoggedOut: useCallback(() => dispatch({ type: 'auth/logged_out' }), []),
    onRestricted: useCallback((data) => dispatch({ type: 'notice/shown', message: restrictionMessage(data) }), []),
  });
  const notices = useModerationNotices({ token: auth.token });

  // Taken out of `auth` so the callback below depends on the function itself, not on the whole (new every render) object.
  const { logout } = auth;
  const account = useAccount({
    token: auth.token,
    user: auth.user,
    onUserChanged: auth.updateUser,
    onTokenReplaced: auth.replaceToken,
    onDeleted: useCallback(() => {
      logout();
      dispatch({ type: 'notice/shown', message: 'Your account has been deleted.' });
    }, [logout]),
  });
  const profileEditor = useProfileEditor({
    token: auth.token,
    user: auth.user,
    active: screen === 'edit-profile',
    onUserChanged: auth.updateUser,
  });
  const safety = useSafety({ token: auth.token, active: screen === 'settings' });
  const holiday = useHoliday({ token: auth.token, user: auth.user, onUserChanged: auth.updateUser });
  // Nothing is drawn near a question, so the bats stay away while one is on screen, a guest's preview included.
  const holidayCalm = screen === 'question' || screen === 'preview';
  const bats = useHolidayBats({
    scene: holiday.scene,
    token: auth.token,
    signedIn: Boolean(auth.user),
    overlayOn: holiday.overlayOn,
    animated: holiday.animated,
    calm: holidayCalm,
  });
  const profileView = useProfile({ username: screen === 'profile' ? viewingProfile : null, token: auth.token });

  const leaderboard = useLeaderboard({ authToken: auth.token });
  const { load: loadBoard, clear: clearBoard } = leaderboard;
  const toasts = useAchievementToasts();

  // The run is over on the server; get the player to their result. The leaderboard is a
  // courtesy here, so a failure to load it must never be what stands between a finished run
  // and its summary — that was one of the two ways this screen could dead-end.
  const finishRun = useCallback(
    async (session) => {
      if (session.mode === 'duel') {
        dispatch({ type: 'run/finished', mode: 'duel' });
        return;
      }
      if (session.mode === 'tournament') {
        dispatch({ type: 'tournament/run_finished' });
        return;
      }
      try {
        await loadBoard(session, 'global', 'current');
      } catch {
        clearBoard();
      }
      dispatch({ type: 'run/finished', mode: 'solo' });
    },
    [loadBoard, clearBoard],
  );

  const run = useRun({ authToken: auth.token, onComplete: finishRun });
  const owl = useOwlPost({ token: auth.token, active: screen === 'owl-post', withUsername: owlWith });
  const duels = useDuels({
    authToken: auth.token,
    currentUser: auth.user,
    run,
    onScreen: dispatchScreen,
    onStartError: dispatchStartError,
    onAchievement: toasts.push,
    onOwlPost: owl.handleSocketEvent,
  });

  useSecretPhrase(SECRET_PHRASE, useCallback(() => dispatch({ type: 'mischief/opened' }), []));

  useEffect(() => {
    getCategories()
      .then((data) => dispatch({ type: 'categories/loaded', categories: data.categories }))
      .catch(() => dispatch({ type: 'categories/loaded', categories: [] }));
  }, []);

  const startRun = async ({ mode, category, canonSource, difficulty }) => {
    dispatch({ type: 'run/start_requested' });
    try {
      const data = await createSession({ mode, category, canonSource, difficulty }, auth.token);
      run.begin({
        session: {
          id: data.session_id,
          mode: data.mode,
          category: data.category,
          canonSource: data.canon_source,
          difficulty: data.difficulty,
          questionCount: data.question_count,
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
      dispatch({ type: 'run/start_succeeded' });
    } catch (err) {
      if (err.code === 'unauthorized') {
        auth.logout();
      } else if (err.code === 'daily_already_played') {
        dispatch({ type: 'run/start_failed', message: "You've already played today's Daily Challenge — come back tomorrow." });
      } else if (err.code === 'no_eligible_questions') {
        dispatch({
          type: 'run/start_failed',
          message: 'No questions match that combination yet — try a different category or canon source.',
        });
      } else {
        dispatch({ type: 'run/start_failed', message: 'Something went wrong starting the run. Try again.' });
      }
    }
  };

  // A challenge and a tournament match start the same way: the server answers with the run's first question.
  const beginFromStartPayload = (data) =>
    run.begin({
      session: {
        id: data.session_id,
        mode: data.mode,
        category: data.category,
        canonSource: data.canon_source,
        difficulty: data.difficulty,
        questionCount: data.question_count,
        timeLimitMs: data.time_limit_ms,
        timingMode: data.timing_mode,
        maxStrikes: data.max_strikes,
        createdAt: data.created_at,
      },
      question: data.question,
      token: data.token,
      issuedAt: data.issued_at,
    });

  const startChallengeRun = async (code) => {
    beginFromStartPayload(await startChallenge(code, auth.token));
    dispatch({ type: 'challenge/started' });
  };

  const startTournamentMatch = async (matchId) => {
    beginFromStartPayload(await playTournamentMatch(matchId, auth.token));
    dispatch({ type: 'tournament/match_started' });
  };

  const leaveRun = () => {
    run.clear();
    dispatch({ type: 'run/left' });
  };

  const openChallenge = (code) => {
    dispatch({ type: 'challenge/opened', code });
  };

  const navigate = (target) => {
    // The envelope always opens the inbox, not whichever conversation was last open.
    if (target === 'owl-post') dispatch({ type: 'owlpost/opened', username: null });
    else dispatch({ type: 'navigated', screen: target });
  };

  const openOwlThread = (username) => dispatch({ type: 'owlpost/opened', username });

  const blockFromOwlPost = async (username) => {
    await safety.block(username);
    dispatch({ type: 'owlpost/closed' });
    dispatch({ type: 'notice/shown', message: `Blocked ${username}. You can undo this in Settings.` });
  };

  const blockFromProfile = async (username) => {
    await safety.block(username);
    dispatch({ type: 'profile/closed' });
    dispatch({ type: 'notice/shown', message: `Blocked ${username}. You can undo this in Settings.` });
  };

  const viewProfile = (username) => {
    dispatch({ type: 'profile/viewed', username });
  };

  if (!auth.checked) {
    return <div className="app-shell" />;
  }

  const { session, question, feedback, answerError } = run;
  const navActiveScreen =
    screen === 'duel-lobby' || screen === 'duel-summary' || screen === 'tournament'
      ? 'friends'
      : screen === 'profile'
        ? // Your own profile is the avatar's screen, however you got there; someone else's keeps
          // lit the tab you came from.
          viewingProfile?.toLowerCase() === auth.user?.username.toLowerCase()
          ? 'my-profile'
          : profileReturnScreen
        : screen === 'challenge'
          ? 'start'
          : screen;

  // The holiday is drawn only while the player has not turned the overlay off. Everything that dresses the page keys on these attributes.
  const dressedScene = holiday.scene && holiday.overlayOn ? holiday.scene : null;
  const holidayAttributes = dressedScene
    ? {
        'data-holiday': dressedScene,
        'data-holiday-calm': holidayCalm ? 'on' : 'off',
        'data-holiday-motion': holiday.animated ? 'full' : 'still',
      }
    : {};

  return (
    <HolidayContext.Provider value={dressedScene}>
    <div className="app-shell" {...holidayAttributes}>
      <Embers />
      {/* Behind everything, so it is never over a question. It stops moving while one is on screen, a guest's preview included. */}
      <HolidayOverlay scene={dressedScene} />
      <HolidayBats bats={bats} />
      {screen !== 'auth' && screen !== 'preview' && screen !== 'recovery' && (
        <NavBar
          currentUser={auth.user}
          activeScreen={navActiveScreen}
          unreadOwls={owl.unread}
          onNavigate={navigate}
          onViewProfile={viewProfile}
          onLogout={auth.logout}
          onSecretFound={() => dispatch({ type: 'mischief/opened' })}
        />
      )}
      {showMischief && (
        <Suspense fallback={null}>
          <MischiefModal
            onClose={() => dispatch({ type: 'mischief/closed' })}
            onSuggest={() => dispatch({ type: 'mischief/suggest_opened' })}
          />
        </Suspense>
      )}
      {screen !== 'auth' && screen !== 'question' && duels.incomingInvites.length > 0 && (
        <DuelInviteBanner invite={duels.incomingInvites[0]} onAccept={duels.accept} onDecline={duels.decline} />
      )}
      {notice && (
        // Reuses the duel notice's look: a single dismissible line is all either one is.
        <div className="duel-notice-banner" role="status" onClick={() => dispatch({ type: 'notice/dismissed' })}>
          {notice}
        </div>
      )}
      {duels.notice && (
        <div className="duel-notice-banner" onClick={duels.dismissNotice}>
          {duels.notice}
        </div>
      )}
      {/* A moderator's notice, then a forced rename, each shown until dealt with: neither can be
          closed, because closing would be the same as not having seen it. */}
      {auth.user && notices.current && <ModerationNoticeModal notice={notices.current} onAcknowledge={notices.acknowledge} />}
      {auth.user && !notices.current && auth.user.must_rename && <RenameModal onRename={account.rename} />}
      <AchievementToast achievement={toasts.current} onDismiss={toasts.dismiss} />
      {screen === 'auth' && (
        <AuthScreen
          onAuthenticated={auth.authenticate}
          onTryPreview={() => dispatch({ type: 'preview/entered' })}
          onForgotPassword={() => dispatch({ type: 'recovery/opened', kind: 'forgot' })}
          startInMode={cameFromPreview ? 'register' : undefined}
        />
      )}
      {screen === 'recovery' && recovery && (
        <Suspense fallback={screenFallback}>
          <RecoveryScreen
            kind={recovery.kind}
            token={recovery.token}
            onDone={() => dispatch({ type: 'recovery/closed', signedIn: Boolean(auth.user) })}
          />
        </Suspense>
      )}
      {screen === 'preview' && (
        <Suspense fallback={screenFallback}>
          <PreviewScreen onDone={() => dispatch({ type: 'preview/done' })} />
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
      {screen === 'settings' && auth.user && (
        <Suspense fallback={screenFallback}>
          <SettingsScreen
            user={auth.user}
            account={account}
            safety={safety}
            holiday={holiday}
            onSelectTheme={auth.selectTheme}
          />
        </Suspense>
      )}
      {screen === 'owl-post' && auth.user && (
        <Suspense fallback={screenFallback}>
          <OwlPostScreen
            user={auth.user}
            owl={owl}
            withUsername={owlWith}
            onOpen={openOwlThread}
            onClose={() => dispatch({ type: 'owlpost/closed' })}
            onViewProfile={viewProfile}
            onBlock={blockFromOwlPost}
            onReport={safety.report}
          />
        </Suspense>
      )}
      {screen === 'edit-profile' && auth.user && (
        <Suspense fallback={screenFallback}>
          <EditProfileScreen user={auth.user} editor={profileEditor} onViewProfile={viewProfile} />
        </Suspense>
      )}
      {screen === 'profile' && viewingProfile && (
        <Suspense fallback={screenFallback}>
          <ProfileScreen
            username={viewingProfile}
            view={profileView}
            ownVisibility={auth.user?.friends_visibility}
            onBack={() => dispatch({ type: 'profile/closed' })}
            onChallenge={duels.openLobby}
            canStartChallenge={auth.user.challenges !== 'off'}
            canStartOwl={auth.user.owl_post !== 'off'}
            onSendOwl={openOwlThread}
            onViewProfile={viewProfile}
            onEditProfile={() => navigate('edit-profile')}
            onChangeVisibility={() => navigate('settings')}
            onBlock={blockFromProfile}
            onReport={safety.report}
          />
        </Suspense>
      )}
      {screen === 'challenge' && challengeCode && (
        <Suspense fallback={screenFallback}>
          <ChallengeScreen
            code={challengeCode}
            token={auth.token}
            onPlay={startChallengeRun}
            onCancel={() => dispatch({ type: 'challenge/canceled' })}
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
      {screen === 'admin-reports' && (auth.user?.role === 'admin' || auth.user?.role === 'moderator') && (
        <Suspense fallback={screenFallback}>
          <AdminReportsScreen token={auth.token} />
        </Suspense>
      )}
      {screen === 'admin-titles' && auth.user?.is_admin && (
        <Suspense fallback={screenFallback}>
          <AdminTitlesScreen token={auth.token} />
        </Suspense>
      )}
      {screen === 'admin-team' && auth.user?.is_admin && (
        <Suspense fallback={screenFallback}>
          <AdminTeamScreen token={auth.token} />
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
            onMessage={openOwlThread}
            canStartChallenge={auth.user.challenges !== 'off'}
            canStartOwl={auth.user.owl_post !== 'off'}
            onViewProfile={viewProfile}
            canMakeTournament={auth.user.challenges !== 'off'}
            onOpenTournament={(code) => dispatch({ type: 'tournament/opened', code })}
          />
        </Suspense>
      )}
      {screen === 'tournament' && tournamentCode && (
        <Suspense fallback={screenFallback}>
          <TournamentScreen
            code={tournamentCode}
            token={auth.token}
            onBack={() => dispatch({ type: 'tournament/closed' })}
            onPlayMatch={startTournamentMatch}
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
            questionCount={session.questionCount}
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
      <HolidayFoot bats={bats} />
      <div className="colophon">
        <p>
          An unofficial fan project. Not affiliated with, endorsed, or sponsored by Warner Bros.,
          Pottermore, or J.K. Rowling.
        </p>
        <button type="button" className="colophon-link" onClick={() => dispatch({ type: 'feedback/opened' })}>
          Submit Feedback
        </button>
        <button type="button" className="colophon-link" onClick={() => dispatch({ type: 'recovery/opened', kind: 'deletion-info' })}>
          Delete your account
        </button>
      </div>
      {showFeedback && (
        <Suspense fallback={null}>
          <FeedbackModal onClose={() => dispatch({ type: 'feedback/closed' })} token={auth.token} page={screen} />
        </Suspense>
      )}
    </div>
    </HolidayContext.Provider>
  );
}
