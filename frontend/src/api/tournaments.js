// Tournaments (/api/tournaments): knockout brackets among friends, each match played on the players' own time inside a
// deadline. A tournament is found by its code, and only people in it can see it. See docs/tournament-brackets-plan.md.
import { request } from './request.js';

export function createTournament({ name, size, roundHours, canonSource }, token) {
  return request(
    '/tournaments',
    { method: 'POST', body: JSON.stringify({ name, size, round_hours: roundHours, canon_source: canonSource }) },
    token,
  );
}

export function joinTournament(code, token) {
  return request('/tournaments/join', { method: 'POST', body: JSON.stringify({ code }) }, token);
}

export function getMyTournaments(token) {
  return request('/tournaments/mine', {}, token);
}

export function getTournament(code, token) {
  return request(`/tournaments/${encodeURIComponent(code)}`, {}, token);
}

export function startTournament(code, token) {
  return request(`/tournaments/${encodeURIComponent(code)}/start`, { method: 'POST' }, token);
}

export function leaveTournament(code, token) {
  return request(`/tournaments/${encodeURIComponent(code)}/leave`, { method: 'POST' }, token);
}

export function cancelTournament(code, token) {
  return request(`/tournaments/${encodeURIComponent(code)}/cancel`, { method: 'POST' }, token);
}

export function removeTournamentPlayer(code, username, token) {
  return request(`/tournaments/${encodeURIComponent(code)}/players/${encodeURIComponent(username)}`, { method: 'DELETE' }, token);
}

// Starts the caller's run of a match: the same payload a challenge run starts with.
export function playTournamentMatch(matchId, token) {
  return request(`/tournaments/matches/${matchId}/play`, { method: 'POST' }, token);
}
