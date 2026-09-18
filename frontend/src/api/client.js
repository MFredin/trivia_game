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

export function register({ email, username, password, inviteCode }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password, invite_code: inviteCode }),
  });
}

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function getMe(token) {
  return request('/auth/me', {}, token);
}

export function updateTheme(theme, token) {
  return request('/auth/theme', { method: 'PATCH', body: JSON.stringify({ theme }) }, token);
}

export function getInviteCode(token) {
  return request('/auth/invite-code', {}, token);
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

export function searchMembers(query, token) {
  return request(`/friends/search?q=${encodeURIComponent(query)}`, {}, token);
}

export function getOnlineMembers(token) {
  return request('/friends/online', {}, token);
}

export function getAllMembers({ limit = 30, offset = 0 } = {}, token) {
  return request(`/friends/members?limit=${limit}&offset=${offset}`, {}, token);
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

export function getDuelLeaderboard(scope = 'global', token) {
  return request(`/duels/leaderboard?scope=${scope}`, {}, token);
}

export function getHouseCup() {
  return request('/leaderboard/house-cup');
}

export function startPreview() {
  return request('/preview/start', { method: 'POST' });
}

export function answerPreview({ previewId, questionId, chosenIndex, token, issuedAt, position }) {
  return request('/preview/answer', {
    method: 'POST',
    body: JSON.stringify({
      preview_id: previewId,
      question_id: questionId,
      chosen_index: chosenIndex,
      token,
      issued_at: issuedAt,
      position,
    }),
  });
}

export function getProfile(username, token) {
  return request(`/profile/${encodeURIComponent(username)}`, {}, token);
}

export function createChallenge({ category, canonSource, difficulty }, token) {
  return request(
    '/challenges',
    { method: 'POST', body: JSON.stringify({ category, canon_source: canonSource, difficulty }) },
    token,
  );
}

export function getChallenge(code, token) {
  return request(`/challenges/${encodeURIComponent(code)}`, {}, token);
}

export function startChallenge(code, token) {
  return request(`/challenges/${encodeURIComponent(code)}/start`, { method: 'POST' }, token);
}

export function getActivity({ scope = 'friends', limit = 20 } = {}, token) {
  return request(`/activity?scope=${scope}&limit=${limit}`, {}, token);
}

export function submitFeedback({ message, category, page }, token) {
  return request('/feedback', { method: 'POST', body: JSON.stringify({ message, category, page }) }, token);
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

// Asks the server for the next question, which is also what starts its clock — so this is
// called when the player dismisses a result, never earlier.
export function fetchNextQuestion(sessionId) {
  return request(`/sessions/${sessionId}/next`, { method: 'POST' });
}

export function getSession(sessionId) {
  return request(`/sessions/${sessionId}`);
}

export function submitAnswer(sessionId, { questionId, chosenIndex, token: questionToken }) {
  return request(`/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, chosen_index: chosenIndex, token: questionToken }),
  });
}

export function submitSuggestion(draft, token) {
  return request('/suggestions', { method: 'POST', body: JSON.stringify(draft) }, token);
}

export function getMySuggestions(token) {
  return request('/suggestions/mine', {}, token);
}

export function getAdminSuggestions(status = 'pending', token) {
  return request(`/suggestions/admin?status=${status}`, {}, token);
}

export function approveSuggestion(id, overrides, token) {
  return request(`/suggestions/admin/${id}/approve`, { method: 'POST', body: JSON.stringify(overrides) }, token);
}

export function rejectSuggestion(id, reviewNote, token) {
  return request(
    `/suggestions/admin/${id}/reject`,
    { method: 'POST', body: JSON.stringify({ review_note: reviewNote }) },
    token,
  );
}
