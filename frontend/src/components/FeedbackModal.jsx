import Modal from './Modal.jsx';
import { useState } from 'react';
import { submitFeedback } from '../api/feedback.js';

export default function FeedbackModal({ onClose, token, page }) {
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (message.trim().length < 10) {
      setError('A few more words would help — what happened, or what would you like to see?');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback({ message, category, page }, token);
      setSent(true);
    } catch (err) {
      if (err.code === 'feedback_not_configured') {
        setError("Feedback isn't wired up on this deployment yet — nothing was lost, but it wasn't filed anywhere either.");
      } else {
        setError('Could not send that just now — try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="feedback-title">
      {sent ? (
        <>
          <p className="screen-eyebrow">Message Sent</p>
          <h2 className="screen-title has-dropcap" id="feedback-title">Owl Delivered</h2>
          <p className="explanation">
            Thanks — this has been filed for the team to look at. Bug reports and ideas both
            genuinely help shape what gets built next.
          </p>
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="screen-eyebrow">Owl Post</p>
          <h2 className="screen-title has-dropcap" id="feedback-title">Submit Feedback</h2>
          <p className="explanation">
            Found a bug, or have an idea for the archive? Say as much or as little as you like.
          </p>
          <form className="start-form" onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            {error && <div className="error-banner">{error}</div>}
            <label>
              Type
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="bug">Something's broken</option>
                <option value="idea">I have an idea</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label>
              Your message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
