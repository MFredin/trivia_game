import { request } from './request.js';

// A run: starting one, being handed each question, answering, and spending a lifeline.
//
// Everything here that names a session id carries the auth token: the server checks the run
// belongs to the caller, so the id on its own is not a credential. The per-question token is a
// separate thing — it proves which question is being answered and when it was issued.
export function createSession({ mode, category, canonSource, difficulty }, token) {
  return request(
    '/sessions',
    { method: 'POST', body: JSON.stringify({ mode, category, canon_source: canonSource, difficulty }) },
    token,
  );
}

// Everything below that names a session id carries the auth token: the server checks the run
// belongs to the caller, so the id on its own is not a credential. The per-question token is a
// separate thing — it proves which question is being answered and when it was issued.
//
// Asks the server for the next question, which is also what starts its clock — so this is
// called when the player dismisses a result, never earlier.
export function fetchNextQuestion(sessionId, token) {
  return request(`/sessions/${sessionId}/next`, { method: 'POST' }, token);
}

export function getSession(sessionId, token) {
  return request(`/sessions/${sessionId}`, {}, token);
}

export function submitAnswer(sessionId, { questionId, chosenIndex, token: questionToken, lifeline }, authToken) {
  return request(`/sessions/${sessionId}/answer`, {
    method: 'POST',
    // `lifeline: 'skip'` travels on the answer so a skip reuses the whole answer flow —
    // session completion, achievements, duel bookkeeping — rather than a parallel route.
    body: JSON.stringify({
      question_id: questionId,
      chosen_index: chosenIndex,
      token: questionToken,
      ...(lifeline ? { lifeline } : {}),
    }),
  }, authToken);
}

// Spends a 50-50. The server decides which choices vanish and returns their indices; the
// client is never told which answer is right, only which two are not.
export function spendLifeline(sessionId, { questionId, token: questionToken, type }, authToken) {
  return request(
    `/sessions/${sessionId}/lifeline`,
    { method: 'POST', body: JSON.stringify({ question_id: questionId, token: questionToken, type }) },
    authToken,
  );
}
