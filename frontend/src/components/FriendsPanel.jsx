import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  getFriendRequests,
  getOnlineMembers,
  listFriends,
  removeFriend,
  searchMembers,
} from '../api/client.js';

const ONLINE_POLL_MS = 15000;

function MemberRow({ member, onAdd, onAccept, onDecline, onChallenge }) {
  return (
    <li className="friend-row">
      <span className="friend-name">
        <span className={`online-dot ${member.online ? 'is-online' : ''}`} aria-hidden="true" />
        {member.username}
      </span>
      <span className="friend-actions">
        {member.status === 'friends' && <span className="explanation">Friends</span>}
        {member.status === 'pending_sent' && <span className="explanation">Request sent</span>}
        {member.status === 'pending_received' && (
          <>
            <button type="button" className="primary-button" onClick={onAccept}>
              Accept
            </button>
            <button type="button" className="secondary-button" onClick={onDecline}>
              Decline
            </button>
          </>
        )}
        {member.status === 'none' && (
          <button type="button" className="secondary-button" onClick={onAdd}>
            Add Friend
          </button>
        )}
        <button type="button" className="primary-button" onClick={onChallenge}>
          Challenge
        </button>
      </span>
    </li>
  );
}

export default function FriendsPanel({ token, pendingDuels, onAcceptDuel, onDeclineDuel, onChallenge }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [onlineMembers, setOnlineMembers] = useState([]);

  const refresh = () => {
    listFriends(token)
      .then((data) => setFriends(data.friends))
      .catch(() => setError('Could not load friends.'));
    getFriendRequests(token)
      .then((data) => setRequests(data.requests))
      .catch(() => {});
  };

  useEffect(refresh, [token]);

  useEffect(() => {
    const refreshOnline = () => {
      getOnlineMembers(token)
        .then((data) => setOnlineMembers(data.results))
        .catch(() => {});
    };
    refreshOnline();
    const interval = setInterval(refreshOnline, ONLINE_POLL_MS);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchMembers(q, token)
        .then((data) => setSearchResults(data.results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

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

  // Search results and the online-now list are both lists of {username, status} members —
  // these three actions work the same way against either one, given that list's setter.
  const setMemberStatus = (setList, username, status) => {
    setList((prev) => prev.map((r) => (r.username === username ? { ...r, status } : r)));
  };

  const handleMemberAdd = async (setList, username) => {
    try {
      await addFriend(username, token);
      setMemberStatus(setList, username, 'pending_sent');
      refresh();
    } catch {
      // leave the row as-is — the request likely already exists in some form
    }
  };

  const handleMemberAccept = async (setList, username) => {
    await acceptFriendRequest(username, token);
    setMemberStatus(setList, username, 'friends');
    refresh();
  };

  const handleMemberDecline = async (setList, username) => {
    await declineFriendRequest(username, token);
    setMemberStatus(setList, username, 'none');
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

      <Plate className="friend-section">
        <h3 className="plate-subhead">Find Members</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username"
          className="friend-add-input"
          style={{ width: '100%' }}
        />
        {searching && <p className="explanation">Searching&hellip;</p>}
        {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
          <p className="explanation">No members match that search.</p>
        )}
        {searchResults.length > 0 && (
          <ul className="friend-list">
            {searchResults.map((r) => (
              <MemberRow
                key={r.id}
                member={r}
                onAdd={() => handleMemberAdd(setSearchResults, r.username)}
                onAccept={() => handleMemberAccept(setSearchResults, r.username)}
                onDecline={() => handleMemberDecline(setSearchResults, r.username)}
                onChallenge={() => onChallenge(r.username)}
              />
            ))}
          </ul>
        )}
      </Plate>

      <Plate className="friend-section">
        <h3 className="plate-subhead">Online Now</h3>
        {onlineMembers.length === 0 ? (
          <p className="explanation">No one else is online right now.</p>
        ) : (
          <ul className="friend-list">
            {onlineMembers.map((r) => (
              <MemberRow
                key={r.id}
                member={{ ...r, online: true }}
                onAdd={() => handleMemberAdd(setOnlineMembers, r.username)}
                onAccept={() => handleMemberAccept(setOnlineMembers, r.username)}
                onDecline={() => handleMemberDecline(setOnlineMembers, r.username)}
                onChallenge={() => onChallenge(r.username)}
              />
            ))}
          </ul>
        )}
      </Plate>

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
