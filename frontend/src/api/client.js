const API_BASE = import.meta.env.VITE_API_URL || '/api';

// How long any single request may hang before we give up on it. Without this a request that
// never settles leaves the caller stuck forever with no way to tell that from a slow one.
const REQUEST_TIMEOUT_MS = 15000;

async function request(path, options = {}, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers,
      // Guarded: AbortSignal.timeout is missing on older mobile Safari, where going without
      // a timeout is still better than throwing on every request.
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        : {}),
      ...options,
    });
  } catch (cause) {
    // Never reached the server, or gave up waiting. Distinct from a server that answered
    // with an error — the two want different words and different retry behaviour.
    const error = new Error('network_unreachable');
    error.code = 'network_unreachable';
    error.transient = true;
    error.timedOut = cause?.name === 'TimeoutError';
    throw error;
  }

  if (res.status === 204) return null;

  // Read as text first: an error from a proxy or load balancer comes back as HTML, and
  // res.json() on that throws a parse error that hides the status code that explains it.
  const body = await res.text().catch(() => '');
  if (res.ok && body === '') return null;

  let data = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = null;
  }

  if (!res.ok || data === null) {
    const error = new Error(data?.error || `http_${res.status}`);
    error.code = data?.error ?? `http_${res.status}`;
    error.status = res.status;
    // 5xx and 429 are worth trying again; a 4xx means this request will never work as-is.
    error.transient = res.status >= 500 || res.status === 429;
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

// Which commit the API is running. Used by the colophon to show when the two services are
// on different releases.
export function getHealth() {
  return request('/health');
}

// This week's system-generated featured challenge. Created server-side on first request of
// the week, so calling this is also what brings it into existence.
export function getFeaturedChallenge() {
  return request('/challenges/featured');
}
