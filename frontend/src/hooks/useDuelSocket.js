import { useEffect, useRef } from 'react';

function resolveWsUrl(token) {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // e.g. https://backend.example/api -> wss://backend.example/ws
    const u = new URL(apiUrl);
    const proto = u.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${u.host}/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

// Keeps one WebSocket connection open for as long as `token` is set, and calls `onEvent` for
// every message the server pushes (duel invites, opponent progress, duel completion, ...).
export function useDuelSocket(token, onEvent) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!token) return undefined;
    const ws = new WebSocket(resolveWsUrl(token));
    ws.onmessage = (msg) => {
      try {
        handlerRef.current(JSON.parse(msg.data));
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, [token]);
}
