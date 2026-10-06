import { useCallback, useEffect, useState } from 'react';
import { blockPlayer, listBlocked, unblockPlayer } from '../../api/blocks.js';
import { reportPlayer } from '../../api/reports.js';

/**
 * Blocking and reporting: the player's own list of who they have blocked, and the actions that
 * change it. The list is only fetched while `active` (Settings is showing it) — nothing else
 * needs it, and the path from opening the app to question one should not pay for it.
 *
 * `block`, `unblock` and `report` throw on failure, so the dialog that asked can say what went
 * wrong where the player is looking, rather than this hook guessing which screen that is.
 */
export function useSafety({ token, active }) {
  const [blocked, setBlocked] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!active || !token) return;
    setLoadError(null);
    listBlocked(token)
      .then((data) => {
        setBlocked(data.blocked);
        setLoaded(true);
      })
      .catch(() => setLoadError('Could not load your blocked players.'));
  }, [active, token]);

  const block = useCallback(
    async (username) => {
      await blockPlayer(username, token);
      // The list is refetched next time Settings opens; until then it may be stale, which is
      // harmless because nothing reads it elsewhere.
      setLoaded(false);
    },
    [token],
  );

  const unblock = useCallback(
    async (username) => {
      await unblockPlayer(username, token);
      setBlocked((prev) => prev.filter((b) => b.username !== username));
    },
    [token],
  );

  const report = useCallback((fields) => reportPlayer(fields, token), [token]);

  return { blocked, loaded, loadError, block, unblock, report };
}
