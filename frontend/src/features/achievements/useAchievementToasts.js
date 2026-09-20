import { useCallback, useEffect, useState } from 'react';

// Long enough to read a name and a line of description without stopping play.
const VISIBLE_MS = 5000;

/**
 * Unlocks arrive over the duel socket, sometimes several at once at the end of a run. A queue
 * rather than a single slot: showing only the newest would silently drop the others, and
 * stacking them would cover the question.
 */
export function useAchievementToasts() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    if (queue.length === 0) return undefined;
    const timer = setTimeout(() => setQueue((prev) => prev.slice(1)), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  return {
    current: queue[0],
    push: useCallback((achievement) => setQueue((prev) => [...prev, achievement]), []),
    dismiss: useCallback(() => setQueue((prev) => prev.slice(1)), []),
  };
}
