import { useCallback, useEffect, useRef } from 'react';
import { getSocketTicket } from '../api/auth.js';

function resolveWsUrl(ticket) {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // e.g. https://backend.example/api -> wss://backend.example/ws
    const u = new URL(apiUrl);
    const proto = u.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${u.host}/ws?ticket=${encodeURIComponent(ticket)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws?ticket=${encodeURIComponent(ticket)}`;
}

// Keeps one WebSocket connection open for as long as `token` is set, and calls `onEvent` for
// every message the server pushes (duel invites, opponent progress, duel completion, ...).
//
// The sign-in token is never put in the URL: the socket is opened with a ticket the server issues for it (api/auth.js getSocketTicket), good for one
// connection within half a minute. If no ticket comes there is no socket, which is how a failed connection already looked: the page works without it.
//
// Returns a send function, because duel reactions are the first thing that travels the other
// way. It is a ref-backed callback with a stable identity, so putting it in a dependency array
// does not retrigger effects on every render.
export function useDuelSocket(token, onEvent) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    let ws = null;
    getSocketTicket(token)
      .then(({ ticket }) => {
        if (cancelled) return;
        ws = new WebSocket(resolveWsUrl(ticket));
        socketRef.current = ws;
        ws.onmessage = (msg) => {
          try {
            handlerRef.current(JSON.parse(msg.data));
          } catch {
            // ignore malformed frames
          }
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      socketRef.current = null;
      ws?.close();
    };
  }, [token]);

  // Dropped silently when the socket is not open. A reaction is a nicety; a player who just
  // reconnected should not be shown an error because a bit of banter did not land.
  return useCallback((event) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }, []);
}
