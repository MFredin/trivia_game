import { request } from './request.js';

// What the app can do without being logged in: whether it can send mail, and the two things it emails.
export function getAuthOptions() {
  return request('/auth/options');
}

export function requestPasswordReset(email) {
  return request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function confirmPasswordReset({ token, password }) {
  return request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export function requestDeletionLink(email) {
  return request('/auth/account-deletion/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function previewDeletion(token) {
  return request(`/auth/account-deletion/preview?token=${encodeURIComponent(token)}`);
}

export function confirmDeletion(token) {
  return request('/auth/account-deletion/confirm', { method: 'POST', body: JSON.stringify({ token }) });
}
