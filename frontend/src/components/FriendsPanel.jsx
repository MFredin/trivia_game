import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { addFriend, listFriends, removeFriend } from '../api/client.js';

export default function FriendsPanel({ token }) {
  const [friends, setFriends] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    listFriends(token)
      .then((data) => setFriends(data.friends))
      .catch(() => setError('Could not load friends.'));
  }, [token]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await addFriend(newFriend.trim(), token);
      setNewFriend('');
      const data = await listFriends(token);
      setFriends(data.friends);
    } catch (err) {
      if (err.code === 'user_not_found') setError('No player with that name.');
      else if (err.code === 'cannot_friend_yourself') setError("That's you.");
      else setError('Could not add that friend.');
    }
  };

  const handleRemove = async (username) => {
    await removeFriend(username, token);
    setFriends((prev) => prev.filter((f) => f.username !== username));
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Correspondents</p>
          <h2 className="screen-title">Friends</h2>
        </div>
      </div>
      <Plate>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.4rem' }}>
          <input
            type="text"
            value={newFriend}
            onChange={(e) => setNewFriend(e.target.value)}
            placeholder="Player name"
            style={{
              flex: 1,
              background: '#f6f1e6',
              border: '1px solid rgba(18,21,28,0.18)',
              borderRadius: '3px',
              padding: '0.75rem 0.85rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--text-on-surface)',
            }}
          />
          <button type="submit" className="primary-button">
            Add
          </button>
        </form>
        {friends.length === 0 ? (
          <p className="explanation">No friends added yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {friends.map((f) => (
              <li
                key={f.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0',
                  borderBottom: '1px solid rgba(18,21,28,0.08)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{f.username}</span>
                <button type="button" className="secondary-button" onClick={() => handleRemove(f.username)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
