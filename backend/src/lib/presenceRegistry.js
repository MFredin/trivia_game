// In-memory registry of connected WebSocket clients per user, shared by the presence-aware
// friends list and the duel event fan-out. A user can have multiple sockets (tabs/devices).
const onlineSockets = new Map();

export function markOnline(userId, socket) {
  if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
  onlineSockets.get(userId).add(socket);
}

export function markOffline(userId, socket) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) onlineSockets.delete(userId);
}

export function isOnline(userId) {
  return onlineSockets.has(userId);
}

export function getSockets(userId) {
  return onlineSockets.get(userId) ?? new Set();
}

export function getOnlineUserIds() {
  return [...onlineSockets.keys()];
}
