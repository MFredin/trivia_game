import { useCallback, useState } from 'react';
import { updateAvatar } from '../../api/account.js';

/**
 * The changes a player makes to their own account from Settings. Each one reports the account
 * as the server now holds it through `onUserChanged`, so what Settings shows and what the rest
 * of the app shows (the nav, the profile) never come from two different copies.
 */
export function useAccount({ token, onUserChanged }) {
  const [avatarError, setAvatarError] = useState(null);

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

  return { setAvatar, avatarError };
}
