import { request } from './request.js';

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
