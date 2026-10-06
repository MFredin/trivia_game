import { useEffect, useId, useState } from 'react';
import Plate from './Plate.jsx';
import { sendErrorText } from '../features/owlpost/sendErrors.js';

const MESSAGE_MAX = 500;
const SUBJECT_MAX = 60;
const SEARCH_DELAY_MS = 250;

/**
 * Writing a new owl: to whom, an optional subject, and the message. The "to" is a name typed in,
 * with your friends and anyone the search finds offered as you type; whether that player accepts
 * owls from you is decided by the server and said in words, so there is no list to be wrong about.
 */
export default function OwlCompose({ friends, found, sending, error, initialTo = '', onLoad, onSearch, onSend, onCancel }) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toMissing, setToMissing] = useState(false);
  const ids = useId();
  const listId = `${ids}-names`;

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  // Search as they type, not on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => onSearch(to), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [to, onSearch]);

  const suggestions = [...new Set([...(friends ?? []).filter((f) => f.can_owl !== false).map((f) => f.username), ...found.map((r) => r.username)])];

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!to.trim()) {
      setToMissing(true);
      return;
    }
    if (!body.trim()) return;
    // Names are exact, so a name typed in another case is matched to the one that was offered.
    const typed = to.trim();
    const match = suggestions.find((n) => n === typed) ?? suggestions.find((n) => n.toLowerCase() === typed.toLowerCase());
    await onSend({ username: match ?? typed, subject: subject.trim(), body });
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
              placeholder="A player’s name"
              aria-describedby={toMissing ? `${ids}-to-error` : undefined}
              aria-invalid={toMissing ? true : undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setToMissing(false);
              }}
            />
            <datalist id={listId}>
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {toMissing && (
              <p className="owl-compose-problem" id={`${ids}-to-error`} role="alert">
                Choose who this owl is for.
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
      </Plate>
    </div>
  );
}
