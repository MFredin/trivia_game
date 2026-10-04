import { useCallback, useState } from 'react';
import { changePassword, deleteAccount, updateFriendsVisibility } from '../../api/account.js';

/**
 * The changes a player makes to their own account from Settings. Each one reports the account
 * through `onUserChanged`, so what Settings shows and what the rest of the app shows (the nav,
 * the profile) never come from two different copies.
 *
 * Privacy changes are applied at once and put back if the server refuses them: a
 * radio button that waits for a round trip before it moves looks broken.
 */
export function useAccount({ token, user, onUserChanged, onDeleted }) {
  const [privacyError, setPrivacyError] = useState(null);

  const setFriendsVisibility = useCallback(
    async (value) => {
      setPrivacyError(null);
      const previous = user;
      onUserChanged({ ...user, friends_visibility: value });
      try {
        const data = await updateFriendsVisibility(value, token);
        onUserChanged(data.user);
      } catch {
        onUserChanged(previous);
        setPrivacyError('Could not save that setting. Try again.');
      }
    },
    [token, user, onUserChanged],
  );

  // These two throw on failure, with the server's error code, so the form that asked can say
  // which field was wrong — a wrong current password and a lost connection want different words.
  const updatePassword = useCallback((fields) => changePassword(fields, token), [token]);

  const removeAccount = useCallback(
    async (password) => {
      await deleteAccount(password, token);
      onDeleted();
    },
    [token, onDeleted],
  );

  return { setFriendsVisibility, privacyError, updatePassword, removeAccount };
}
