import { useCallback, useState } from 'react';
import { changePassword, deleteAccount, updateAvatar, updateFriendsVisibility } from '../../api/account.js';

/**
 * The changes a player makes to their own account from Settings. Each one reports the account
 * as the server now holds it through `onUserChanged`, so what Settings shows and what the rest
 * of the app shows (the nav, the profile) never come from two different copies.
 */
export function useAccount({ token, onUserChanged, onDeleted }) {
  const [avatarError, setAvatarError] = useState(null);
  const [privacyError, setPrivacyError] = useState(null);

  const setAvatar = useCallback(
    async (avatar) => {
      setAvatarError(null);
      try {
        const data = await updateAvatar(avatar, token);
        onUserChanged(data.user);
      } catch {
        setAvatarError('Could not save that sigil. Try again.');
      }
    },
    [token, onUserChanged],
  );

  const setFriendsVisibility = useCallback(
    async (value) => {
      setPrivacyError(null);
      try {
        const data = await updateFriendsVisibility(value, token);
        onUserChanged(data.user);
      } catch {
        setPrivacyError('Could not save that setting. Try again.');
      }
    },
    [token, onUserChanged],
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

  return { setAvatar, avatarError, setFriendsVisibility, privacyError, updatePassword, removeAccount };
}
