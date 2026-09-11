async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || 'request_failed');
    error.code = data.error;
    error.status = res.status;
    throw error;
  }
  return data;
}

export function getCategories() {
  return request('/categories');
}

export function getLeaderboard(mode = 'classic') {
  return request(`/leaderboard?mode=${mode}`);
}

export function createSession({ username, mode, category, canonSource }) {
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ username, mode, category, canon_source: canonSource }),
  });
}

export function submitAnswer(sessionId, { questionId, chosenIndex, token }) {
  return request(`/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, chosen_index: chosenIndex, token }),
  });
}
