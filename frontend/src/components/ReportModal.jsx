import { useState } from 'react';
import Modal from './Modal.jsx';
import { REPORT_DETAILS_MAX, REPORT_REASONS } from '../constants/reportReasons.js';

/**
 * Report a player to the moderators. Reasons are a fixed list so a report is something an admin
 * can scan; the note is optional. Once sent, the dialog offers to block them too — the two are
 * often wanted together, but reporting must never silently do it.
 */
export default function ReportModal({ username, onSubmit, onBlock, onClose }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason) {
      setError('Pick the closest reason first.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({ username, reason, details: details.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(err.code === 'too_many_attempts' ? 'You have sent a lot of reports — try again later.' : 'Could not send that. Try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <Modal onClose={onClose} labelledBy="report-title">
        <p className="screen-eyebrow">Report Sent</p>
        <h2 className="screen-title" id="report-title">
          Thank you
        </h2>
        <p className="explanation">A moderator will look at this. {username} is not told who reported them.</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onBlock}>
            Also block {username}
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="report-title">
      <p className="screen-eyebrow">Report a Player</p>
      <h2 className="screen-title" id="report-title">
        Report {username}
      </h2>
      <form className="report-form" onSubmit={submit}>
        <fieldset className="privacy-fieldset">
          <legend className="explanation">What is the problem?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="privacy-option" htmlFor={`report-reason-${r.id}`}>
              <input
                type="radio"
                id={`report-reason-${r.id}`}
                name="report-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
              <span className="privacy-option-label">{r.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="report-note" htmlFor="report-details">
          Anything a moderator should know? (optional)
          <textarea
            id="report-details"
            value={details}
            maxLength={REPORT_DETAILS_MAX}
            rows={3}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Sending…' : 'Send report'}
          </button>
          <button type="button" className="secondary-button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
