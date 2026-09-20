import { useCallback, useEffect, useState } from 'react';
import { acceptDuel, createDuel, declineDuel, getPendingDuels } from '../../api/duels.js';
import { useDuelSocket } from '../../hooks/useDuelSocket.js';
import { duelReactionLabel } from '../../constants/duelReactions.js';

/**
 * Duels: invitations, the lobby, the live opponent strip, reactions, and the result.
 *
 * A duel is a run, so this hook does not own run state — it calls `run.begin(...)` the same way
 * starting a solo run does. That is the dependency direction the architecture rule describes:
 * a feature that needs another calls its API rather than reaching into its state. Before the
 * split, the `duel:started` socket handler set fifteen pieces of run state by hand.
 *
 * The socket also carries achievement unlocks, which are not a duel concern; they are handed
 * straight out through `onAchievement` rather than parked here.
 */
export function useDuels({ authToken, currentUser, run, onScreen, onStartError, onAchievement }) {
  // The two run entry points this hook uses, pulled out because `run` itself is a fresh object
  // literal every render and would churn every callback below that listed it as a dependency.
  const { begin: beginRun, clear: clearRun, session: runSession } = run;
  const [pendingDuels, setPendingDuels] = useState([]);
  const [lobbyOpponent, setLobbyOpponent] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);
  const [opponentUsername, setOpponentUsername] = useState(null);
  const [opponentLive, setOpponentLive] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reaction, setReaction] = useState(null);

  useEffect(() => {
    if (!authToken) return;
    getPendingDuels(authToken)
      .then((data) => setPendingDuels(data.pending))
      .catch(() => {});
  }, [authToken]);

  const handleEvent = (event) => {
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
        if (outgoing?.duel_id === event.duel_id) {
          setNotice(`${outgoing.opponent_username} declined your challenge.`);
          setOutgoing(null);
        }
        break;
      }
      case 'duel:started': {
        if (outgoing?.duel_id !== event.duel_id) break;
        setOpponentUsername(outgoing.opponent_username);
        setOpponentLive(null);
        setResult(null);
        setOutgoing(null);
        beginRun({
          session: {
            id: event.session_id,
            // Carried so a reaction knows which duel it belongs to; the session id alone
            // does not tell the server that.
            duelId: event.duel_id,
            mode: 'duel',
            category: outgoing.category,
            canonSource: outgoing.canon_source,
            difficulty: outgoing.difficulty,
            timeLimitMs: event.time_limit_ms,
            timingMode: 'per_question',
            maxStrikes: null,
            createdAt: new Date().toISOString(),
          },
          question: event.question,
          token: event.token,
          issuedAt: event.issued_at,
        });
        onScreen('question');
        break;
      }
      case 'duel:reaction': {
        const label = duelReactionLabel(event.reaction);
        if (label) setReaction({ reaction: event.reaction, label, from: event.from_username, at: Date.now() });
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
        setResult({ yourScore: mine?.total_score ?? 0, opponentScore: theirs?.total_score ?? 0 });
        break;
      }
      case 'achievement:unlocked': {
        onAchievement(event.achievement);
        break;
      }
      default:
        break;
    }
  };

  const send = useDuelSocket(authToken, handleEvent);

  const openLobby = useCallback((username) => {
    setLobbyOpponent(username);
    setOutgoing(null);
    setLobbyError(null);
    onScreen('duel-lobby');
  }, [onScreen]);

  const leaveLobby = useCallback(() => onScreen('friends'), [onScreen]);

  const invite = useCallback(async ({ category, canonSource, difficulty }) => {
    setLobbyError(null);
    try {
      const data = await createDuel({ opponentUsername: lobbyOpponent, category, canonSource, difficulty }, authToken);
      setOutgoing({
        duel_id: data.duel_id,
        opponent_username: data.opponent_username,
        category: data.category,
        canon_source: data.canon_source,
        difficulty: data.difficulty,
      });
    } catch (err) {
      if (err.code === 'user_not_found') setLobbyError('That player could not be found.');
      else setLobbyError('Could not send that challenge.');
    }
  }, [lobbyOpponent, authToken]);

  const accept = useCallback(async (duelId) => {
    const inviteDetails = pendingDuels.find((d) => d.duel_id === duelId);
    try {
      const data = await acceptDuel(duelId, authToken);
      setOpponentUsername(inviteDetails?.created_by_username ?? null);
      setOpponentLive(null);
      setResult(null);
      beginRun({
        session: {
          id: data.session_id,
          duelId,
          mode: 'duel',
          category: inviteDetails?.category ?? null,
          canonSource: inviteDetails?.canon_source ?? 'combined',
          difficulty: inviteDetails?.difficulty ?? null,
          timeLimitMs: data.time_limit_ms,
          timingMode: 'per_question',
          maxStrikes: null,
          createdAt: new Date().toISOString(),
        },
        question: data.question,
        token: data.token,
        issuedAt: data.issued_at,
      });
      setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
      onScreen('question');
    } catch {
      setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
      onStartError('Could not accept that duel — it may no longer be pending.');
    }
  }, [pendingDuels, authToken, beginRun, onScreen, onStartError]);

  const decline = useCallback(async (duelId) => {
    setPendingDuels((prev) => prev.filter((d) => d.duel_id !== duelId));
    try {
      await declineDuel(duelId, authToken);
    } catch {
      // already resolved server-side; the local list is already updated
    }
  }, [authToken]);

  const done = useCallback(() => {
    clearRun();
    setResult(null);
    setOpponentLive(null);
    setOpponentUsername(null);
    onScreen('friends');
  }, [clearRun, onScreen]);

  const react = useCallback((reactionId) => {
    if (!runSession?.duelId) return;
    send({ type: 'duel:react', duel_id: runSession.duelId, reaction: reactionId });
  }, [runSession?.duelId, send]);

  return {
    pendingDuels,
    incomingInvites: pendingDuels.filter((d) => d.direction === 'incoming'),
    lobbyOpponent,
    outgoing,
    lobbyError,
    opponentUsername,
    opponentLive,
    result,
    notice,
    reaction,
    dismissNotice: () => setNotice(null),
    openLobby,
    leaveLobby,
    invite,
    accept,
    decline,
    done,
    react,
  };
}
