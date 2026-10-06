import { useCallback, useEffect, useState } from 'react';
import { getTeam, setRole } from '../../api/team.js';

/** The admin's team screen: who is a moderator or an admin, and making or unmaking a moderator. */
export function useAdminTeam({ token }) {
  const [team, setTeam] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getTeam(token)
      .then((data) => setTeam(data.team))
      .catch(() => setError('Could not load the team.'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const change = useCallback(
    async (username, role, giveTitle = false) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await setRole({ username, role, giveTitle }, token);
        setNotice(role === 'moderator' ? `${username} is a moderator.` : `${username} is no longer a moderator.`);
        load();
        return true;
      } catch (err) {
        setError(
          err.code === 'user_not_found'
            ? 'There is no player by that name.'
            : err.code === 'cannot_change_admin'
              ? 'An admin’s role is not changed here.'
              : 'Could not change that.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, load],
  );

  return { team, error, notice, busy, change };
}
