import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  getFriendRequests,
  listFriends,
  removeFriend,
} from '../api/client.js';

export default function FriendsPanel({ token, pendingDuels, onAcceptDuel, onDeclineDuel, onChallenge }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState(null);

  const refresh = () => {
    listFriends(token)
      .then((data) => setFriends(data.friends))
      .catch(() => setError('Could not load friends.'));
    getFriendRequests(token)
      .then((data) => setRequests(data.requests))
      .catch(() => {});
  };

  useEffect(refresh, [token]);

  const handleAdd = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await addFriend(newFriend.trim(), token);
      setNewFriend('');
      refresh();
    } catch (err) {
      if (err.code === 'user_not_found') setError('No player with that name.');
      else if (err.code === 'cannot_friend_yourself') setError("That's you.");
      else setError('Could not send that request.');
    }
  };

  const handleAccept = async (username) => {
    await acceptFriendRequest(username, token);
    refresh();
  };

  const handleDecline = async (username) => {
    await declineFriendRequest(username, token);
    setRequests((prev) => prev.filter((r) => r.username !== username));
  };

  const handleRemove = async (username) => {
    await removeFriend(username, token);
    setFriends((prev) => prev.filter((f) => f.username !== username));
  };

  const incomingDuels = pendingDuels.filter((d) => d.direction === 'incoming');
  const outgoingDuels = pendingDuels.filter((d) => d.direction === 'outgoing');

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Correspondents</p>
          <h2 className="screen-title">Friends</h2>
        </div>
      </div>

      {requests.length > 0 && (
        <Plate className="friend-section">
          <h3 className="plate-subhead">Friend Requests</h3>
          <ul className="friend-list">
            {requests.map((r) => (
              <li key={r.id} className="friend-row">
                <span className="friend-name">{r.username}</span>
                <span className="friend-actions">
                  <button type="button" className="primary-button" onClick={() => handleAccept(r.username)}>
                    Accept
                  </button>
                  <button type="button" className="secondary-button" onClick={() => handleDecline(r.username)}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Plate>
      )}

      {(incomingDuels.length > 0 || outgoingDuels.length > 0) && (
        <Plate className="friend-section">
          <h3 className="plate-subhead">Duels</h3>
          <ul className="friend-list">
            {incomingDuels.map((d) => (
              <li key={d.duel_id} className="friend-row">
                <span className="friend-name">{d.created_by_username} challenged you</span>
                <span className="friend-actions">
                  <button type="button" className="primary-button" onClick={() => onAcceptDuel(d.duel_id)}>
                    Accept
                  </button>
                  <button type="button" className="secondary-button" onClick={() => onDeclineDuel(d.duel_id)}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
            {outgoingDuels.map((d) => (
              <li key={d.duel_id} className="friend-row">
                <span className="friend-name">Waiting on {d.opponent_username}&hellip;</span>
              </li>
            ))}
          </ul>
        </Plate>
      )}

      <Plate>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleAdd} className="friend-add-form">
          <input
            type="text"
            value={newFriend}
            onChange={(e) => setNewFriend(e.target.value)}
            placeholder="Player name"
            className="friend-add-input"
          />
          <button type="submit" className="primary-button">
            Send Request
          </button>
        </form>
        {friends.length === 0 ? (
          <p className="explanation">No friends yet — send a request above.</p>
        ) : (
          <ul className="friend-list">
            {friends.map((f) => (
              <li key={f.id} className="friend-row">
                <span className="friend-name">
                  <span className={`online-dot ${f.online ? 'is-online' : ''}`} aria-hidden="true" />
                  {f.username}
                </span>
                <span className="friend-actions">
                  <button type="button" className="primary-button" onClick={() => onChallenge(f.username)}>
                    Challenge
                  </button>
                  <button type="button" className="secondary-button" onClick={() => handleRemove(f.username)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
