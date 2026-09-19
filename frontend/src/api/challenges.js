import { request } from './request.js';

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

// This week's system-generated featured challenge. Created server-side on first request of
// the week, so calling this is also what brings it into existence.
export function getFeaturedChallenge() {
  return request('/challenges/featured');
}
