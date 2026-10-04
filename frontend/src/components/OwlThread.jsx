import { useEffect, useRef, useState } from 'react';
import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';
import IconButton from './IconButton.jsx';
import Icon from './icons.jsx';
import PopoverMenu from './PopoverMenu.jsx';

const MESSAGE_MAX = 500;

const stamp = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// What a refused send says, in the player's terms.
const SEND_ERRORS = {
  message_too_long: 'That is too long — owls carry up to 500 characters.',
  message_has_link: 'Owls cannot carry links, email addresses, handles or phone numbers.',
  message_not_allowed: 'That contains language that is not allowed here.',
  message_empty: 'Write something first.',
  duplicate_message: 'You just sent that.',
  too_many_attempts: 'Slow down — you are sending a lot of owls. Try again in a moment.',
  user_not_found: 'That owl could not be delivered. They may have switched Owl Post off.',
};

function sendErrorText(error) {
  if (!error) return null;
  if (error.code === 'owl_post_muted') {
    const until = error.until ? new Date(error.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
    return `A moderator has stopped you sending owls${until ? ` until ${until}` : ''}.`;
  }
  if (error.code === 'owl_post_off') return 'Owl Post is switched off. You can turn it on in Settings.';
  return SEND_ERRORS[error.code] ?? 'That did not send. Try again.';
}

/** One conversation: the messages, a composer, and the menu for reporting or blocking. */
export default function OwlThread({ thread, user, sending, sendError, onSend, onLoadOlder, onDelete, onBack, onViewProfile, onReport, onBlock }) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState(null);
  const endRef = useRef(null);
  const count = thread.messages.length;

  // New messages land at the bottom of the view, as in any conversation.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [count]);

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
  const blockedReason = muted
    ? `A moderator has stopped you sending owls until ${new Date(user.muted_until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
    : off
      ? 'Owl Post is switched off, so you cannot send. You can turn it on in Settings.'
      : theyAreOff
        ? `${thread.username} has switched Owl Post off, so they cannot receive owls right now.`
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
              <span className="screen-title owl-thread-name">{thread.username}</span>
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

        {thread.hasMore && (
          <button type="button" className="secondary-button owl-older" onClick={onLoadOlder}>
            Earlier owls
          </button>
        )}

        <ol className="owl-messages" aria-label={`Conversation with ${thread.username}`}>
          {thread.messages.map((m) => (
            <li key={m.id} className={`owl-message ${m.from_me ? 'owl-message--mine' : ''}`}>
              <button
                type="button"
                className="owl-bubble"
                aria-expanded={selected === m.id}
                onClick={() => setSelected(selected === m.id ? null : m.id)}
              >
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
        <div ref={endRef} />
      </Plate>

      <form className="owl-composer" onSubmit={submit}>
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
