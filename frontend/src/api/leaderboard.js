import { request } from './request.js';

export function getLeaderboard(mode = 'classic', { category, canonSource, difficulty, scope, window } = {}, token) {
  const params = new URLSearchParams({ mode });
  if (category) params.set('category', category);
  if (canonSource) params.set('canon_source', canonSource);
  if (difficulty) params.set('difficulty', difficulty);
  if (scope) params.set('scope', scope);
  if (window) params.set('window', window);
  return request(`/leaderboard?${params.toString()}`, {}, token);
}

export function getHouseCup() {
  return request('/leaderboard/house-cup');
}
