const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers, ...options });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'request_failed');
    error.code = data.error;
    error.status = res.status;
    throw error;
  }
  return data;
}

export function register({ email, username, password }) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function getMe(token) {
  return request('/auth/me', {}, token);
}

export function listFriends(token) {
  return request('/friends', {}, token);
}

export function addFriend(username, token) {
  return request('/friends', { method: 'POST', body: JSON.stringify({ username }) }, token);
}

export function removeFriend(username, token) {
  return request(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }, token);
}

export function getFriendRequests(token) {
  return request('/friends/requests', {}, token);
}

export function acceptFriendRequest(username, token) {
  return request(`/friends/requests/${encodeURIComponent(username)}/accept`, { method: 'POST' }, token);
}

export function declineFriendRequest(username, token) {
  return request(`/friends/requests/${encodeURIComponent(username)}/decline`, { method: 'POST' }, token);
}

export function createDuel({ opponentUsername, category, canonSource, difficulty }, token) {
  return request(
    '/duels',
    {
      method: 'POST',
      body: JSON.stringify({ opponent_username: opponentUsername, category, canon_source: canonSource, difficulty }),
    },
    token,
  );
}

export function getPendingDuels(token) {
  return request('/duels/pending', {}, token);
}

export function acceptDuel(duelId, token) {
  return request(`/duels/${duelId}/accept`, { method: 'POST' }, token);
}

export function declineDuel(duelId, token) {
  return request(`/duels/${duelId}/decline`, { method: 'POST' }, token);
}

export function getCategories() {
  return request('/categories');
}

export function getAchievements(token) {
  return request('/achievements', {}, token);
}

export function getLeaderboard(mode = 'classic', { category, canonSource, difficulty, scope, window } = {}, token) {
  const params = new URLSearchParams({ mode });
  if (category) params.set('category', category);
  if (canonSource) params.set('canon_source', canonSource);
  if (difficulty) params.set('difficulty', difficulty);
  if (scope) params.set('scope', scope);
  if (window) params.set('window', window);
  return request(`/leaderboard?${params.toString()}`, {}, token);
}

export function createSession({ mode, category, canonSource, difficulty }, token) {
  return request(
    '/sessions',
    { method: 'POST', body: JSON.stringify({ mode, category, canon_source: canonSource, difficulty }) },
    token,
  );
}

export function submitAnswer(sessionId, { questionId, chosenIndex, token: questionToken }) {
  return request(`/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, chosen_index: chosenIndex, token: questionToken }),
  });
}
