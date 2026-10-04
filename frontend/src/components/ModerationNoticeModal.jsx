import { useState } from 'react';
import Modal from './Modal.jsx';
import { MODERATION_ACTION_BY_ID } from '../constants/moderationActions.js';

/**
 * A message from the moderators, shown until it has been read and acknowledged. It cannot be closed
 * with Escape or by clicking outside: closing it would be the same as not having seen it.
 */
export default function ModerationNoticeModal({ notice, onAcknowledge }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const acknowledge = async () => {
    setPending(true);
    setError(false);
    try {
      await onAcknowledge(notice.batch_id);
    } catch {
      setError(true);
      setPending(false);
    }
  };

  return (
    <Modal onClose={() => {}} labelledBy="notice-title">
      <p className="screen-eyebrow">A Message From the Moderators</p>
      <h2 className="screen-title" id="notice-title">
        Please read this
      </h2>
      <div className="explanation" style={{ textAlign: 'left' }}>
        <p className="notice-note">{notice.note}</p>
        <p className="notice-taken">
          <b>What was done:</b> {notice.actions.map((a) => MODERATION_ACTION_BY_ID[a]?.label ?? a).join(', ')}
        </p>
        <p>If you think this is a mistake, use Submit Feedback at the foot of any page.</p>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          That did not go through. Try again.
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="primary-button" disabled={pending} onClick={acknowledge}>
          {pending ? 'Saving…' : 'I understand'}
        </button>
      </div>
    </Modal>
  );
}
