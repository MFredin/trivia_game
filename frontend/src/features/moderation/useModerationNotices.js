import { useCallback, useEffect, useState } from 'react';
import { acknowledgeNotice, getNotices } from '../../api/moderation.js';

/**
 * Warnings and notices a moderator has left for the signed-in player. Fetched once when they sign
 * in, and shown one at a time until each is acknowledged — a notice is not a toast, it does not go
 * away because the player looked elsewhere.
 */
export function useModerationNotices({ token }) {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    if (!token) {
      setNotices([]);
      return;
    }
    getNotices(token)
      .then((data) => setNotices(data.notices))
      .catch(() => {});
  }, [token]);

  // Throws on failure, so the dialog that asked can say so and stay open.
  const acknowledge = useCallback(
    async (batchId) => {
      await acknowledgeNotice(batchId, token);
      setNotices((prev) => prev.filter((n) => n.batch_id !== batchId));
    },
    [token],
  );

  return { current: notices[0] ?? null, acknowledge };
}
