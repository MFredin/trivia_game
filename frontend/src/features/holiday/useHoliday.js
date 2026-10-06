import { useCallback, useEffect, useState } from 'react';
import { getHolidayOverlay, saveHolidayPrefs } from '../../api/holiday.js';

/**
 * The holiday overlay: which one is on today, and the signed-in player's two switches for it.
 *
 * What is on is the server's call, made from the date (backend/src/lib/holidayOverlay.js), so every player sees the same
 * holiday and a change of dates is one edit in one place. A failure to ask is "no holiday": the overlay is decoration,
 * and a missing decoration costs nothing, where a banner about it would cost attention.
 *
 * Both switches are on until a player turns them off. Someone who is not signed in has no account to hold a choice, so
 * they see the defaults. A switch moves at once and is put back if the server refuses it, as the other settings do.
 */
export function useHoliday({ token, user, onUserChanged }) {
  const [scene, setScene] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getHolidayOverlay()
      .then((data) => {
        if (!cancelled) setScene(data?.overlay ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (prefs) => {
      setError(null);
      const previous = user;
      onUserChanged({
        ...user,
        ...(prefs.overlay !== undefined ? { holiday_overlay: prefs.overlay } : {}),
        ...(prefs.motion !== undefined ? { holiday_motion: prefs.motion } : {}),
      });
      try {
        const data = await saveHolidayPrefs(prefs, token);
        onUserChanged(data.user);
      } catch {
        onUserChanged(previous);
        setError('Could not save that setting. Try again.');
      }
    },
    [token, user, onUserChanged],
  );

  return {
    scene,
    overlayOn: user ? user.holiday_overlay !== false : true,
    animated: user ? user.holiday_motion !== false : true,
    save,
    error,
  };
}
