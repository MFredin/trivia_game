import { useCallback, useEffect, useState } from 'react';
import { getProfile, getProfileFriends } from '../../api/profile.js';
import { acceptFriendRequest, addFriend, declineFriendRequest } from '../../api/friends.js';

const FRIENDS_PAGE_SIZE = 30;

/**
 * One player's file as the viewer sees it: their profile, their friends list (when the viewer
 * is allowed one), and the things the viewer can do about their relationship — all keyed to the
 * username so that moving to another profile starts clean rather than showing the last
 * person's friends under the next person's name.
 */
export function useProfile({ username, token }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState({ visible: false, list: [], total: null, hasMore: false, loading: true });
  const [actionError, setActionError] = useState(null);

  const loadFriends = useCallback(
    (offset) => {
      setFriends((prev) => ({ ...prev, loading: true }));
      getProfileFriends(username, { limit: FRIENDS_PAGE_SIZE, offset }, token)
        .then((data) =>
          setFriends((prev) => ({
            visible: data.visible,
            list: offset === 0 ? data.friends : [...prev.list, ...data.friends],
            total: data.total,
            hasMore: data.has_more,
            loading: false,
          })),
        )
        .catch(() => setFriends((prev) => ({ ...prev, loading: false })));
    },
    [username, token],
  );

  useEffect(() => {
    // `username` is null whenever the profile screen is not showing, so the shell can call this
    // hook unconditionally without it fetching anyone.
    if (!username) return;
    setProfile(null);
    setError(null);
    setActionError(null);
    setFriends({ visible: false, list: [], total: null, hasMore: false, loading: true });
    getProfile(username, token)
      .then((data) => {
        setProfile(data);
        if (data.friends.visible) loadFriends(0);
        else setFriends((prev) => ({ ...prev, loading: false }));
      })
      .catch(() => setError('Could not load that player file.'));
  }, [username, token, loadFriends]);

  const setRelationship = (relationship) => setProfile((prev) => (prev ? { ...prev, relationship } : prev));

  // Each action reports a failure where the viewer is looking, and leaves the relationship as it
  // was — the buttons never claim a request went through when it did not.
  const run = async (action, onDone) => {
    setActionError(null);
    try {
      await action();
      onDone();
    } catch {
      setActionError('That did not go through. Try again.');
    }
  };

  return {
    profile,
    error,
    friends,
    actionError,
    loadMoreFriends: () => loadFriends(friends.list.length),
    add: () =>
      run(
        () => addFriend(username, token),
        () => setRelationship('pending_sent'),
      ),
    accept: () =>
      run(
        () => acceptFriendRequest(username, token),
        () => {
          setRelationship('friends');
          getProfile(username, token).then(setProfile).catch(() => {});
        },
      ),
    decline: () =>
      run(
        () => declineFriendRequest(username, token),
        () => setRelationship('none'),
      ),
  };
}
