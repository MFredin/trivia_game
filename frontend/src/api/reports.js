import { request } from './request.js';

export function reportPlayer({ username, reason, details }, token) {
  return request('/reports', { method: 'POST', body: JSON.stringify({ username, reason, details }) }, token);
}

export function getReports(status, token) {
  return request(`/reports?status=${status}`, {}, token);
}

export function resolveReport(id, outcome, token) {
  return request(`/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome }) }, token);
}
