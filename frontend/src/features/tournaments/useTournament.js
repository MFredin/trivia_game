import { useCallback, useEffect, useState } from 'react';
import {
  cancelTournament, getTournament, leaveTournament, removeTournamentPlayer, startTournament,
} from '../../api/tournaments.js';
import { tournamentMessage } from './tournamentMessages.js';

/**
 * One tournament, for the screen that shows it: its players, rounds and matches, and what the creator and the players can do
 * to it. Reloaded when the screen opens and after every action, since the server is the only one that knows who has won.
 */
export function useTournament({ code, token }) {
  const [tournament, setTournament] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTournament(await getTournament(code, token));
      setError(null);
    } catch (err) {
      setError(tournamentMessage(err));
    }
  }, [code, token]);

  useEffect(() => {
    setTournament(null);
    reload();
  }, [reload]);

  // Runs an action, then re-reads the tournament either way: a refusal usually means someone else changed it first.
  const act = async (action) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (err) {
      setError(tournamentMessage(err));
      return false;
    } finally {
      await reload();
      setBusy(false);
    }
  };

  return {
    tournament,
    error,
    busy,
    reload,
    start: () => act(() => startTournament(code, token)),
    leave: () => act(() => leaveTournament(code, token)),
    cancel: () => act(() => cancelTournament(code, token)),
    removePlayer: (username) => act(() => removeTournamentPlayer(code, username, token)),
  };
}
