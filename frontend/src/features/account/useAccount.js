import { useCallback, useState } from 'react';
import { changePassword, deleteAccount, renameUser, updateFriendsVisibility } from '../../api/account.js';
import { setOwlPostMode } from '../../api/owlpost.js';
import { setChallengeMode } from '../../api/duels.js';

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
  const [owlPostError, setOwlPostError] = useState(null);
  const [challengesError, setChallengesError] = useState(null);

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

  const setOwlPost = useCallback(
    async (mode) => {
      setOwlPostError(null);
      const previous = user;
      onUserChanged({ ...user, owl_post: mode });
      try {
        const data = await setOwlPostMode(mode, token);
        onUserChanged(data.user);
      } catch {
        onUserChanged(previous);
        setOwlPostError('Could not save that setting. Try again.');
      }
    },
    [token, user, onUserChanged],
  );

  const setChallenges = useCallback(
    async (mode) => {
      setChallengesError(null);
      const previous = user;
      onUserChanged({ ...user, challenges: mode });
      try {
        const data = await setChallengeMode(mode, token);
        onUserChanged(data.user);
      } catch {
        onUserChanged(previous);
        setChallengesError('Could not save that setting. Try again.');
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

  // Throws on failure, so the dialog can say which way it failed (name taken, name not allowed).
  const rename = useCallback(
    async (username) => {
      const data = await renameUser(username, token);
      onUserChanged(data.user);
    },
    [token, onUserChanged],
  );

  return { rename, setOwlPost, owlPostError, setChallenges, challengesError, setFriendsVisibility, privacyError, updatePassword, removeAccount };
}
