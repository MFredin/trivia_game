import { useCallback, useEffect, useState } from 'react';
import { createTournament, getMyTournaments, joinTournament } from '../../api/tournaments.js';
import { tournamentMessage } from './tournamentMessages.js';

/**
 * The Tournaments tab on the Community screen: the tournaments the player is in, making a new one, and joining one by code.
 * Loaded when the tab is first opened (`active`), not on every visit to Community.
 */
export function useTournaments({ token, active }) {
  const [tournaments, setTournaments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTournaments((await getMyTournaments(token)).tournaments);
      setError(null);
    } catch (err) {
      setError(tournamentMessage(err));
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    if (active && !loaded) reload();
  }, [active, loaded, reload]);

  // Both return the new tournament's code, or null after setting `error`, so the caller can open it.
  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const { code } = await action();
      await reload();
      return code;
    } catch (err) {
      setError(tournamentMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    tournaments,
    loaded,
    error,
    busy,
    create: (settings) => run(() => createTournament(settings, token)),
    join: (code) => run(() => joinTournament(code.trim().toLowerCase(), token)),
  };
}
