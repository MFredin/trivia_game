import { useEffect, useId, useState } from 'react';
import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';
import { sendErrorText } from '../features/owlpost/sendErrors.js';

const MESSAGE_MAX = 500;
const SUBJECT_MAX = 60;

/**
 * Writing a new owl: to whom, an optional subject, and the message. Owl Post is between friends, so
 * "to whom" is picked from your friends by typing their name; a name that is not a friend is said
 * so, with the way to become one, rather than failing at the server.
 */
export default function OwlCompose({ friends, sending, error, initialTo = '', onLoad, onSend, onCancel, onGoToCommunity }) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toError, setToError] = useState(null);
  const ids = useId();
  const listId = `${ids}-friends`;

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  const typed = to.trim();
  const friend = friends?.find((f) => f.username.toLowerCase() === typed.toLowerCase()) ?? null;
  const noFriends = friends && friends.length === 0;

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!friend) {
      setToError(typed ? 'notFriend' : 'empty');
      return;
    }
    if (!body.trim()) return;
    await onSend({ username: friend.username, subject: subject.trim(), body });
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Correspondence</p>
          <h2 className="screen-title">Send an owl</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <Plate>
        {friends === null && <p className="explanation">Fetching your friends&hellip;</p>}

        {noFriends && (
          <div className="owl-compose-empty">
            <p className="explanation">
              Owls can only be sent to friends, and you have not added anyone yet. Find people on the Community screen and
              send a request; once they accept, you can write to them here.
            </p>
            <button type="button" className="primary-button" onClick={onGoToCommunity}>
              Find people
            </button>
          </div>
        )}

        {friends && friends.length > 0 && (
          <form className="owl-compose" onSubmit={submit}>
            <div className="owl-compose-field">
              <label className="field-label" htmlFor={`${ids}-to`}>
                To
              </label>
              <input
                id={`${ids}-to`}
                type="text"
                className="friend-add-input"
                value={to}
                list={listId}
                autoComplete="off"
                autoCapitalize="off"
                placeholder="Start typing a friend’s name"
                aria-describedby={toError ? `${ids}-to-error` : undefined}
                aria-invalid={toError ? true : undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setToError(null);
                }}
              />
              <datalist id={listId}>
                {friends.map((f) => (
                  <option key={f.id} value={f.username} />
                ))}
              </datalist>
              {friend && (
                <p className="owl-compose-recipient">
                  <Avatar username={friend.username} avatar={friend.avatar} style={friend.avatar_style} house={friend.theme} size={28} />
                  <span>{friend.username}</span>
                </p>
              )}
              {toError === 'empty' && (
                <p className="owl-compose-problem" id={`${ids}-to-error`} role="alert">
                  Choose who this owl is for.
                </p>
              )}
              {toError === 'notFriend' && (
                <p className="owl-compose-problem" id={`${ids}-to-error`} role="alert">
                  {typed} is not on your friends list, and owls can only be sent to friends.{' '}
                  <button type="button" className="owl-compose-link" onClick={onGoToCommunity}>
                    Find people on Community
                  </button>
                </p>
              )}
            </div>

            <div className="owl-compose-field">
              <label className="field-label" htmlFor={`${ids}-subject`}>
                Subject <span className="owl-compose-optional">(optional)</span>
              </label>
              <input
                id={`${ids}-subject`}
                type="text"
                className="friend-add-input"
                value={subject}
                maxLength={SUBJECT_MAX}
                autoComplete="off"
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="owl-compose-field">
              <label className="field-label" htmlFor={`${ids}-body`}>
                Message
              </label>
              <textarea
                id={`${ids}-body`}
                className="owl-compose-body"
                value={body}
                rows={5}
                maxLength={MESSAGE_MAX}
                onChange={(e) => setBody(e.target.value)}
              />
              <span className="owl-composer-help">
                Plain text, no links. {[...body].length}/{MESSAGE_MAX}
              </span>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                {sendErrorText(error)}
              </div>
            )}

            <div className="owl-compose-actions">
              <button type="submit" className="primary-button" disabled={!body.trim() || sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Plate>
    </div>
  );
}
