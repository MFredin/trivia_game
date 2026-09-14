import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import {
  acceptFriendRequest,
  addFriend,
  declineFriendRequest,
  getActivity,
  getAllMembers,
  getFriendRequests,
  getOnlineMembers,
  listFriends,
  removeFriend,
  searchMembers,
} from '../api/client.js';

const ONLINE_POLL_MS = 15000;
const MEMBERS_PAGE_SIZE = 30;

const ACTIVITY_MODE_LABELS = {
  classic: 'Classic Quiz',
  daily: 'Daily Challenge',
  blitz: 'Blitz',
  survival: 'Survival',
  gauntlet: 'Gauntlet',
  duel: 'a Duel',
  challenge: 'a Challenge',
};

function ActivityRow({ event }) {
  if (event.type === 'personal_best') {
    const modeLabel = ACTIVITY_MODE_LABELS[event.payload.mode] ?? event.payload.mode;
    return (
      <li className="friend-row">
        <span className="friend-name">
          🏆 {event.username} beat their personal best: {event.payload.total_score} in {modeLabel}
        </span>
      </li>
    );
  }
  if (event.type === 'achievement_unlocked') {
    return (
      <li className="friend-row">
        <span className="friend-name">
          🎖️ {event.username} unlocked &ldquo;{event.payload.name}&rdquo;
        </span>
      </li>
    );
  }
  if (event.type === 'duel_win') {
    return (
      <li className="friend-row">
        <span className="friend-name">
          ⚔️ {event.username} won a duel against {event.payload.opponent_username}, {event.payload.my_score}-
          {event.payload.opponent_score}
        </span>
      </li>
    );
  }
  return null;
}

function MemberRow({ member, onAdd, onAccept, onDecline, onChallenge, onViewProfile }) {
  return (
    <li className="friend-row">
      <button type="button" className="friend-name friend-name-link" onClick={onViewProfile}>
        <span className={`online-dot ${member.online ? 'is-online' : ''}`} aria-hidden="true" />
        {member.username}
      </button>
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

export default function FriendsPanel({ token, pendingDuels, onAcceptDuel, onDeclineDuel, onChallenge, onViewProfile }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [error, setError] = useState(null);

  const [discoverTab, setDiscoverTab] = useState('online');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [onlineMembers, setOnlineMembers] = useState([]);

  const [allMembers, setAllMembers] = useState([]);
  const [allMembersTotal, setAllMembersTotal] = useState(0);
  const [allMembersHasMore, setAllMembersHasMore] = useState(false);
  const [loadingAllMembers, setLoadingAllMembers] = useState(false);
  const [allMembersLoaded, setAllMembersLoaded] = useState(false);

  const [activity, setActivity] = useState([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const refresh = () => {
    listFriends(token)
      .then((data) => setFriends(data.friends))
      .catch(() => setError('Could not load friends.'));
    getFriendRequests(token)
      .then((data) => setRequests(data.requests))
      .catch(() => {});
  };

  useEffect(refresh, [token]);

  // The plain Friends list's online-dot used to only refresh on mount/actions while Online
  // Now polled every 15s — inconsistent, and a friend's dot could sit stale until something
  // else happened to trigger a refetch. Both now ride the same interval.
  useEffect(() => {
    const refreshOnline = () => {
      getOnlineMembers(token)
        .then((data) => setOnlineMembers(data.results))
        .catch(() => {});
      refresh();
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

  const loadAllMembers = (offset) => {
    setLoadingAllMembers(true);
    getAllMembers({ limit: MEMBERS_PAGE_SIZE, offset }, token)
      .then((data) => {
        setAllMembers((prev) => (offset === 0 ? data.results : [...prev, ...data.results]));
        setAllMembersTotal(data.total);
        setAllMembersHasMore(data.has_more);
        setAllMembersLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoadingAllMembers(false));
  };

  useEffect(() => {
    if (discoverTab === 'all' && !allMembersLoaded) loadAllMembers(0);
  }, [discoverTab, allMembersLoaded]);

  useEffect(() => {
    if (discoverTab !== 'activity' || activityLoaded) return;
    getActivity({ scope: 'friends' }, token)
      .then((data) => setActivity(data.events))
      .catch(() => {})
      .finally(() => setActivityLoaded(true));
  }, [discoverTab, activityLoaded, token]);

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
        <div className="nav-links on-surface" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`nav-btn ${discoverTab === 'online' ? 'is-active' : ''}`}
            onClick={() => setDiscoverTab('online')}
          >
            Online Now
          </button>
          <button
            type="button"
            className={`nav-btn ${discoverTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setDiscoverTab('all')}
          >
            All Members
          </button>
          <button
            type="button"
            className={`nav-btn ${discoverTab === 'search' ? 'is-active' : ''}`}
            onClick={() => setDiscoverTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={`nav-btn ${discoverTab === 'activity' ? 'is-active' : ''}`}
            onClick={() => setDiscoverTab('activity')}
          >
            Activity
          </button>
        </div>

        {discoverTab === 'search' && (
          <>
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
                    onViewProfile={() => onViewProfile(r.username)}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {discoverTab === 'online' &&
          (onlineMembers.length === 0 ? (
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
                    onViewProfile={() => onViewProfile(r.username)}
                />
              ))}
            </ul>
          ))}

        {discoverTab === 'all' && (
          <>
            {allMembersLoaded && (
              <p className="explanation">
                {allMembersTotal} member{allMembersTotal === 1 ? '' : 's'} total
              </p>
            )}
            {loadingAllMembers && allMembers.length === 0 ? (
              <p className="explanation">Loading&hellip;</p>
            ) : allMembers.length === 0 ? (
              <p className="explanation">No other members yet.</p>
            ) : (
              <ul className="friend-list">
                {allMembers.map((r) => (
                  <MemberRow
                    key={r.id}
                    member={r}
                    onAdd={() => handleMemberAdd(setAllMembers, r.username)}
                    onAccept={() => handleMemberAccept(setAllMembers, r.username)}
                    onDecline={() => handleMemberDecline(setAllMembers, r.username)}
                    onChallenge={() => onChallenge(r.username)}
                    onViewProfile={() => onViewProfile(r.username)}
                  />
                ))}
              </ul>
            )}
            {allMembersHasMore && (
              <button
                type="button"
                className="secondary-button"
                disabled={loadingAllMembers}
                onClick={() => loadAllMembers(allMembers.length)}
              >
                {loadingAllMembers ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}

        {discoverTab === 'activity' &&
          (!activityLoaded ? (
            <p className="explanation">Loading&hellip;</p>
          ) : activity.length === 0 ? (
            <p className="explanation">Nothing yet — play a run, add a friend, or win a duel to see it here.</p>
          ) : (
            <ul className="friend-list">
              {activity.map((event, i) => (
                <ActivityRow key={i} event={event} />
              ))}
            </ul>
          ))}
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
                <button type="button" className="friend-name friend-name-link" onClick={() => onViewProfile(f.username)}>
                  <span className={`online-dot ${f.online ? 'is-online' : ''}`} aria-hidden="true" />
                  {f.username}
                </button>
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
