// Who may see a player's list of friends. The list is the one part of a profile that exposes
// OTHER people (their usernames and avatars), and it lets a stranger map out a social graph, so
// it defaults to the narrowest setting that is still social: friends only. Stats and
// achievements stay open to any signed-in player, as they always were.
export const FRIENDS_VISIBILITY = ['everyone', 'friends', 'only_me'];
export const DEFAULT_FRIENDS_VISIBILITY = 'friends';

export function isValidFriendsVisibility(value) {
  return FRIENDS_VISIBILITY.includes(value);
}

export function canSeeFriends({ visibility, isSelf, isFriend }) {
  if (isSelf) return true;
  if (visibility === 'everyone') return true;
  if (visibility === 'friends') return isFriend;
  return false;
}
