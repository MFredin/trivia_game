import { useCallback, useEffect, useState } from 'react';
import { getHolidayOverlay, saveHolidayPrefs } from '../../api/holiday.js';
import { HOLIDAYS } from '../../constants/holidays.js';

/**
 * The holiday overlay: which one is on, and the signed-in player's switches for it.
 *
 * What is on is the server's call, made from the date (backend/src/lib/holidayOverlay.js), so every player sees the same holiday and a change
 * of dates is one edit in one place. A failure to ask is "no holiday": the overlay is decoration, and a missing decoration costs nothing, where
 * a banner about it would cost attention.
 *
 * An admin may choose the holiday instead, to see any of them on any day (`holiday_override`); everyone else follows the calendar. The server
 * only ever sends the override to an admin, and this checks the flag too, so a stale value on an account that is no longer an admin does nothing.
 *
 * Both switches are on until a player turns them off. Someone who is not signed in has no account to hold a choice, so they see the defaults.
 * A switch moves at once and is put back if the server refuses it, as the other settings do.
 */
export function useHoliday({ token, user, onUserChanged }) {
  const [calendar, setCalendar] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getHolidayOverlay()
      .then((data) => {
        if (!cancelled) setCalendar(HOLIDAYS[data?.overlay] ? data.overlay : null);
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
        ...(prefs.override !== undefined ? { holiday_override: prefs.override } : {}),
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

  const isAdmin = Boolean(user?.is_admin);
  const override = isAdmin && HOLIDAYS[user.holiday_override] ? user.holiday_override : null;

  return {
    scene: override ?? calendar,
    calendar,
    override,
    isAdmin,
    overlayOn: user ? user.holiday_overlay !== false : true,
    animated: user ? user.holiday_motion !== false : true,
    save,
    error,
  };
}
