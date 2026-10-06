import { request } from './request.js';

export function createChallenge({ category, canonSource, difficulty, questionCount }, token) {
  return request(
    '/challenges',
    {
      method: 'POST',
      body: JSON.stringify({ category, canon_source: canonSource, difficulty, question_count: questionCount }),
    },
    token,
  );
}

export function getChallenge(code, token) {
  return request(`/challenges/${encodeURIComponent(code)}`, {}, token);
}

export function startChallenge(code, token) {
  return request(`/challenges/${encodeURIComponent(code)}/start`, { method: 'POST' }, token);
}

// This week's system-generated featured challenge. Created server-side on first request of
// the week, so calling this is also what brings it into existence.
export function getFeaturedChallenge() {
  return request('/challenges/featured');
}

// The season running now, or { season: null } between seasons. Like the featured challenge, asking for it is also what
// creates it server-side.
export function getSeasonChallenge() {
  return request('/challenges/season');
}
