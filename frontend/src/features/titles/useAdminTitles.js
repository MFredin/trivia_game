import { useCallback, useEffect, useState } from 'react';
import { getTitleHolders, grantSystemTitle, revokeSystemTitle } from '../../api/titles.js';

/** The admin's titles screen: who holds a system title, and giving and taking them back. */
export function useAdminTitles({ token }) {
  const [holders, setHolders] = useState(null);
  const [available, setAvailable] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getTitleHolders(token)
      .then((data) => {
        setHolders(data.holders);
        setAvailable(data.available);
      })
      .catch(() => setError('Could not load who holds a title.'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const grant = useCallback(
    async (username, title) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const res = await grantSystemTitle({ username, title }, token);
        setNotice(res?.ok ? `Granted.` : null);
        load();
        return true;
      } catch (err) {
        setError(err.code === 'user_not_found' ? 'There is no player by that name.' : 'Could not grant that title.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, load],
  );

  const revoke = useCallback(
    async (username, title) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await revokeSystemTitle(username, title, token);
        setNotice('Taken back.');
        load();
      } catch {
        setError('Could not take that title back.');
      } finally {
        setBusy(false);
      }
    },
    [token, load],
  );

  return { holders, available, error, notice, busy, grant, revoke };
}
