import { useState } from 'react';
import Modal from './Modal.jsx';

/** Sending a report up to the admins: an optional note on why. The report stays open, at the top of their queue. */
export default function EscalateModal({ report, onSend, onClose }) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    setPending(true);
    setError(null);
    try {
      await onSend(note.trim());
    } catch {
      setError('That did not go through. Nothing was changed.');
      setPending(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="escalate-title">
      <p className="screen-eyebrow">Send to an Admin</p>
      <h2 className="screen-title" id="escalate-title">
        {report.reported_username}
      </h2>
      <p className="explanation">
        {report.suggestion?.needs_admin
          ? 'The usual step here is a ban or a longer suspension, which only an admin can apply.'
          : 'An admin will look at this next. The report stays open.'}
      </p>
      <label className="start-form-field" htmlFor="escalate-note">
        <span className="field-label">Why (optional)</span>
        <textarea id="escalate-note" rows={4} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="primary-button" disabled={pending} onClick={send}>
          {pending ? 'Sending…' : 'Send to an admin'}
        </button>
        <button type="button" className="secondary-button" disabled={pending} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
