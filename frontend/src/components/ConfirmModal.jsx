import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * "Are you sure?" for an action that is not instantly undone. The confirm button names the
 * action rather than saying "OK", and a failure is shown here, inside the dialog, so the player
 * is not left wondering whether the thing happened behind it.
 */
export default function ConfirmModal({ eyebrow, title, children, confirmLabel, onConfirm, onCancel }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('That did not go through. Try again.');
      setPending(false);
    }
  };

  return (
    <Modal onClose={onCancel} labelledBy="confirm-title">
      <p className="screen-eyebrow">{eyebrow}</p>
      <h2 className="screen-title" id="confirm-title">
        {title}
      </h2>
      <div className="explanation">{children}</div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="primary-button" disabled={pending} onClick={confirm}>
          {pending ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="secondary-button" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
