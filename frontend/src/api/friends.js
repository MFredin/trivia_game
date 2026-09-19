import { request } from './request.js';

export function listFriends(token) {
  return request('/friends', {}, token);
}

export function addFriend(username, token) {
  return request('/friends', { method: 'POST', body: JSON.stringify({ username }) }, token);
}

export function removeFriend(username, token) {
  return request(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }, token);
}

export function getFriendRequests(token) {
  return request('/friends/requests', {}, token);
}

export function searchMembers(query, token) {
  return request(`/friends/search?q=${encodeURIComponent(query)}`, {}, token);
}

export function getOnlineMembers(token) {
  return request('/friends/online', {}, token);
}

export function getAllMembers({ limit = 30, offset = 0 } = {}, token) {
  return request(`/friends/members?limit=${limit}&offset=${offset}`, {}, token);
}

export function acceptFriendRequest(username, token) {
  return request(`/friends/requests/${encodeURIComponent(username)}/accept`, { method: 'POST' }, token);
}

export function declineFriendRequest(username, token) {
  return request(`/friends/requests/${encodeURIComponent(username)}/decline`, { method: 'POST' }, token);
}
