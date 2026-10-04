import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteOwl, getInbox, getThread, getUnread, markThreadRead, sendOwl } from '../../api/owlpost.js';

const UNREAD_POLL_MS = 60000;

const EMPTY_THREAD = { username: null, who: null, messages: [], hasMore: false, loading: false, error: null };

/**
 * Owl Post: the unread count that follows the player around, the inbox, and one conversation.
 *
 * `active` is whether the Owl Post screen is showing and `withUsername` is the conversation open on
 * it, if any; both come from the shell. A new owl arrives over the same WebSocket the duels use
 * (`handleSocketEvent` is handed to that hook), and the count is also re-read every minute, because
 * a socket can drop and a count that only ever goes up would be wrong for as long as it did.
 */
export function useOwlPost({ token, active, withUsername }) {
  const [unread, setUnread] = useState(0);
  const [inbox, setInbox] = useState(null);
  const [thread, setThread] = useState(EMPTY_THREAD);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const openWith = useRef(null);
  openWith.current = active ? withUsername : null;

  const refreshUnread = useCallback(() => {
    if (!token) return;
    getUnread(token)
      .then((data) => setUnread(data.count))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUnread(0);
      setInbox(null);
      setThread(EMPTY_THREAD);
      return undefined;
    }
    refreshUnread();
    const interval = setInterval(refreshUnread, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [token, refreshUnread]);

  const loadInbox = useCallback(() => {
    getInbox(token)
      .then((data) => setInbox(data.conversations))
      .catch(() => setInbox([]));
  }, [token]);

  useEffect(() => {
    if (active && !withUsername && token) loadInbox();
  }, [active, withUsername, token, loadInbox]);

  // Opening a conversation reads it: the messages are fetched, then marked read, then the count is
  // re-read so the badge drops the moment they are on screen.
  useEffect(() => {
    if (!active || !withUsername || !token) {
      setThread(EMPTY_THREAD);
      return;
    }
    setThread({ ...EMPTY_THREAD, username: withUsername, loading: true });
    setSendError(null);
    getThread(withUsername, {}, token)
      .then((data) => {
        setThread({ username: withUsername, who: data.with, messages: data.messages, hasMore: data.has_more, loading: false, error: null });
        return markThreadRead(withUsername, token).then(refreshUnread);
      })
      .catch(() => setThread({ ...EMPTY_THREAD, username: withUsername, error: 'Could not open that conversation.' }));
  }, [active, withUsername, token, refreshUnread]);

  const handleSocketEvent = useCallback(
    (event) => {
      if (event.type !== 'owlpost:message') return;
      const { message } = event;
      if (openWith.current === message.from_username) {
        // The conversation is open: it lands in place and is read at once.
        setThread((prev) => ({ ...prev, messages: [...prev.messages, { id: message.id, body: message.body, created_at: message.created_at, from_me: false }] }));
        markThreadRead(message.from_username, token).then(refreshUnread).catch(() => {});
        return;
      }
      setUnread((n) => n + 1);
      if (openWith.current === null) loadInbox();
    },
    [token, refreshUnread, loadInbox],
  );

  // Throws nothing: the reason a send failed is kept for the composer to show beside the box.
  const send = useCallback(
    async (body) => {
      if (!thread.username) return false;
      setSending(true);
      setSendError(null);
      try {
        const data = await sendOwl(thread.username, body, token);
        setThread((prev) => ({ ...prev, messages: [...prev.messages, data.message] }));
        return true;
      } catch (err) {
        setSendError({ code: err.code, until: err.data?.until ?? null });
        return false;
      } finally {
        setSending(false);
      }
    },
    [thread.username, token],
  );

  const loadOlder = useCallback(async () => {
    const first = thread.messages[0];
    if (!first || !thread.hasMore) return;
    try {
      const data = await getThread(thread.username, { before: first.id }, token);
      setThread((prev) => ({ ...prev, messages: [...data.messages, ...prev.messages], hasMore: data.has_more }));
    } catch {
      setSendError({ code: 'load_older_failed' });
    }
  }, [thread, token]);

  const remove = useCallback(
    async (id) => {
      await deleteOwl(id, token);
      setThread((prev) => ({ ...prev, messages: prev.messages.filter((m) => m.id !== id) }));
    },
    [token],
  );

  return { unread, inbox, thread, sending, sendError, send, loadOlder, remove, handleSocketEvent };
}
