import { request } from './request.js';

export function getProfile(username, token) {
  return request(`/profile/${encodeURIComponent(username)}`, {}, token);
}
