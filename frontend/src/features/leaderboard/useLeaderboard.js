import { useCallback, useState } from 'react';
import { getLeaderboard } from '../../api/leaderboard.js';

/**
 * The standings shown beside a finished run, segmented the same way the run was.
 *
 * `load` throws so the caller can decide what a failure means. It matters at the end of a run:
 * the leaderboard is a courtesy there, and a failure to fetch it must never be what stands
 * between a finished run and its summary — that was one of the two ways the summary screen
 * used to dead-end.
 */
export function useLeaderboard({ authToken }) {
  const [entries, setEntries] = useState([]);
  const [scope, setScope] = useState('global');
  const [window, setWindow] = useState('current');

  const load = useCallback(async (session, nextScope, nextWindow) => {
    const data = await getLeaderboard(
      session.mode,
      {
        category: session.category,
        canonSource: session.canonSource,
        difficulty: session.difficulty,
        scope: nextScope,
        window: nextWindow,
      },
      authToken,
    );
    setEntries(data.entries);
    setScope(nextScope);
    setWindow(nextWindow);
  }, [authToken]);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, scope, window, load, clear };
}
