import { request } from './request.js';

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
