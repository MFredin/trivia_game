import { useEffect, useState } from 'react';
import { addFriend, listFriends, removeFriend } from '../api/client.js';

export default function FriendsPanel({ token }) {
  const [friends, setFriends] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    listFriends(token)
      .then((data) => setFriends(data.friends))
      .catch(() => setError('Could not load friends.'));
  }, [open, token]);

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

  if (!open) {
    return (
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        Friends
      </button>
    );
  }

  return (
    <div className="question-card" style={{ marginTop: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>Friends</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={newFriend}
          onChange={(e) => setNewFriend(e.target.value)}
          placeholder="Player name"
          style={{ flex: 1 }}
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
              style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}
            >
              <span>{f.username}</span>
              <button type="button" className="secondary-button" onClick={() => handleRemove(f.username)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary-button" style={{ marginTop: '0.75rem' }} onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  );
}
