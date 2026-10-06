import { useLayoutEffect, useRef, useState } from 'react';
import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';
import IconButton from './IconButton.jsx';
import Icon from './icons.jsx';
import PopoverMenu from './PopoverMenu.jsx';
import PlayerTitle from './PlayerTitle.jsx';
import { sendErrorText } from '../features/owlpost/sendErrors.js';
import { useFillViewport } from '../features/owlpost/useFillViewport.js';

const MESSAGE_MAX = 500;

const stamp = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One conversation: the messages, a composer, and the menu for reporting or blocking. */
export default function OwlThread({ thread, user, sending, sendError, onSend, onLoadOlder, onDelete, onBack, onViewProfile, onReport, onBlock }) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(null);
  const scrollerRef = useRef(null);
  const composerRef = useRef(null);
  useFillViewport(scrollerRef, composerRef);
  const count = thread.messages.length;

  // Where the conversation was last time it changed, and whether the reader was at the bottom of it. The
  // messages scroll inside their own area (CSS .owl-scroll), so the position is kept here rather than left to
  // the page: the newest owl is shown when the thread opens or when a new one arrives to a reader who was
  // already at the bottom, and loading older owls above must not move what is being read.
  const placed = useRef({ username: null, first: null, last: null, height: 0 });
  const following = useRef(true);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = thread.messages[0]?.id ?? null;
    const last = thread.messages.at(-1)?.id ?? null;
    const prev = placed.current;
    const opened = prev.username !== thread.username || prev.last === null;
    const newest = thread.messages.at(-1);

    if (opened || (last !== prev.last && (following.current || newest?.from_me))) {
      el.scrollTop = el.scrollHeight;
      following.current = true;
    } else if (first !== prev.first && last === prev.last) {
      // Older owls were added above: move down by what was added, so the same owl stays where it was.
      el.scrollTop += el.scrollHeight - prev.height;
    }
    placed.current = { username: thread.username, first, last, height: el.scrollHeight };
  }, [thread.messages, thread.username]);

  // Within a few pixels of the end counts as "at the bottom", so a rounding difference never stops following.
  const onScroll = (event) => {
    const el = event.currentTarget;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    if (await onSend(draft)) setDraft('');
  };

  const onKeyDown = (event) => {
    // Enter sends; the server collapses line breaks anyway, so there is no Shift+Enter to explain.
    if (event.key === 'Enter' && !event.shiftKey) submit(event);
  };

  const who = thread.who;
  const muted = Boolean(user.muted_until);
  const off = user.owl_post === 'off';
  const theyAreOff = who && who.accepts_owls === false;
  const waiting = who && who.awaiting_reply === true;
  const blockedReason = muted
    ? `A moderator has stopped you sending owls until ${new Date(user.muted_until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
    : off
      ? 'Owl Post is switched off, so you cannot send. You can turn it on in Settings.'
      : theyAreOff
        ? `${thread.username} is not accepting owls from you.`
        : waiting
          ? `You have sent ${thread.username} an owl. You can write again once they answer.`
          : null;

  return (
    <div>
      <div className="screen-head">
        <div className="owl-thread-title">
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
          {who && (
            <button type="button" className="member-id owl-thread-who" onClick={() => onViewProfile(thread.username)}>
              <Avatar username={thread.username} avatar={who.avatar} style={who.avatar_style} house={who.theme} size={40} />
              <span className="owl-thread-name-block">
                <span className="screen-title owl-thread-name">{thread.username}</span>
                <PlayerTitle title={who.title} onPage />
              </span>
            </button>
          )}
        </div>
        {who && (
          <PopoverMenu
            label="More actions"
            triggerClassName="icon-button icon-button--secondary"
            trigger={<Icon name="more" />}
            items={[
              { key: 'report', label: 'Report', icon: 'alert', danger: true, onSelect: onReport },
              { key: 'block', label: 'Block', icon: 'ban', danger: true, onSelect: onBlock },
            ]}
          />
        )}
      </div>

      <Plate>
        {thread.error && (
          <div className="error-banner" role="alert">
            {thread.error}
          </div>
        )}
        {thread.loading && <p className="explanation">Fetching&hellip;</p>}
        {who && who.is_friend === false && (
          <p className="explanation owl-stranger-note">
            You and {thread.username} are not friends. You can report or block them from the menu above.
          </p>
        )}

        {/* The one scrolling part of the page. It takes focus (tabIndex) so the keyboard can scroll it. */}
        <div className="owl-scroll" ref={scrollerRef} onScroll={onScroll} role="region" aria-label={`Conversation with ${thread.username}`} tabIndex={0}>
        {thread.hasMore && (
          <button type="button" className="secondary-button owl-older" onClick={onLoadOlder}>
            Earlier owls
          </button>
        )}

        <ol className="owl-messages">
          {thread.messages.map((m) => (
            <li key={m.id} className={`owl-message ${m.from_me ? 'owl-message--mine' : ''}`}>
              <button
                type="button"
                className="owl-bubble"
                aria-expanded={selected === m.id}
                onClick={() => setSelected(selected === m.id ? null : m.id)}
              >
                {m.subject && <span className="owl-bubble-subject">{m.subject}</span>}
                <span className="owl-bubble-text">{m.body}</span>
                <span className="owl-bubble-time">{stamp(m.created_at)}</span>
              </button>
              {selected === m.id && (
                <IconButton
                  icon="x"
                  label="Delete for me"
                  showLabel
                  onClick={async () => {
                    await onDelete(m.id);
                    setSelected(null);
                  }}
                />
              )}
            </li>
          ))}
        </ol>
        {!thread.loading && count === 0 && !thread.error && <p className="explanation">No owls yet — say hello.</p>}
        </div>
      </Plate>

      <form className="owl-composer" ref={composerRef} onSubmit={submit}>
        {blockedReason ? (
          <p className="explanation owl-blocked" role="status">
            {blockedReason}
          </p>
        ) : (
          <>
            <label className="visually-hidden" htmlFor="owl-draft">
              Your owl to {thread.username}
            </label>
            <textarea
              id="owl-draft"
              value={draft}
              rows={2}
              maxLength={MESSAGE_MAX}
              placeholder="Write an owl…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="owl-composer-row">
              <span className="owl-composer-help">
                Plain text, no links. {[...draft].length}/{MESSAGE_MAX}
              </span>
              <button type="submit" className="primary-button" disabled={!draft.trim() || sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
        {sendError && (
          <div className="error-banner" role="alert">
            {sendErrorText(sendError)}
          </div>
        )}
      </form>
    </div>
  );
}
