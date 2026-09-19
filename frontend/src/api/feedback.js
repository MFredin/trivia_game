import { request } from './request.js';

export function submitFeedback({ message, category, page }, token) {
  return request('/feedback', { method: 'POST', body: JSON.stringify({ message, category, page }) }, token);
}
