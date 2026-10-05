// A player's public profile (/api/profile/:username) and their friends list, which its owner may hide.
import { request } from './request.js';

export function getProfile(username, token) {
  return request(`/profile/${encodeURIComponent(username)}`, {}, token);
}

export function getProfileFriends(username, { limit = 30, offset = 0 } = {}, token) {
  return request(`/profile/${encodeURIComponent(username)}/friends?limit=${limit}&offset=${offset}`, {}, token);
}
