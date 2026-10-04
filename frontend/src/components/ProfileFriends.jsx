import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';

const VISIBILITY_WORDS = {
  everyone: 'every signed-in player',
  friends: 'friends only',
  only_me: 'only you',
};

/**
 * The Friends plate on a profile. Three states that look different on purpose: a list, an empty
 * list, and a list the owner keeps private — the last must not read as "no friends", which would
 * be both untrue and, for someone with a lot of them, a little rude.
 */
export default function ProfileFriends({ friends, isSelf, ownVisibility, onViewProfile, onLoadMore, onChangeVisibility }) {
  return (
    <Plate>
      <h3 className="plate-subhead">
        Friends
        {friends.visible && friends.total != null && <span className="profile-friends-count"> · {friends.total}</span>}
      </h3>

      {!friends.visible && !friends.loading && (
        <p className="explanation">This player keeps their friends list private.</p>
      )}

      {friends.visible && friends.list.length === 0 && !friends.loading && (
        <p className="explanation">{isSelf ? 'No friends yet — find people on the Friends screen.' : 'No friends yet.'}</p>
      )}

      {friends.list.length > 0 && (
        <ul className="profile-friends-grid">
          {friends.list.map((f) => (
            <li key={f.username}>
              <button type="button" className="profile-friend" onClick={() => onViewProfile(f.username)}>
                <Avatar username={f.username} avatar={f.avatar} house={f.theme} size={40} />
                <span className="profile-friend-name">
                  <span className={`online-dot ${f.online ? 'is-online' : ''}`} aria-hidden="true" />
                  {f.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {friends.hasMore && (
        <button type="button" className="secondary-button" disabled={friends.loading} onClick={onLoadMore}>
          {friends.loading ? 'Loading…' : 'Show more'}
        </button>
      )}

      {isSelf && ownVisibility && (
        <p className="explanation profile-friends-privacy">
          Who can see this list: {VISIBILITY_WORDS[ownVisibility]}.{' '}
          <button type="button" className="profile-link" onClick={onChangeVisibility}>
            Change
          </button>
        </p>
      )}
    </Plate>
  );
}
