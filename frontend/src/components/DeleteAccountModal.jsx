import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Deleting an account cannot be undone, so the dialog says exactly what goes and what stays, and
 * asks for two things a stray tap cannot supply: the player's own name, typed, and their password.
 */
export default function DeleteAccountModal({ username, onDelete, onClose }) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const nameMatches = typed.trim() === username;

  const submit = async (event) => {
    event.preventDefault();
    if (!nameMatches || !password) return;
    setPending(true);
    setError(null);
    try {
      await onDelete(password);
    } catch (err) {
      if (err.code === 'incorrect_password') setError('That is not your password.');
      else if (err.code === 'too_many_attempts') setError('Too many attempts — try again in a little while.');
      else setError('Could not delete your account. Nothing was changed — try again.');
      setPending(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="delete-account-title">
      <p className="screen-eyebrow">Delete Account</p>
      <h2 className="screen-title" id="delete-account-title">
        Delete your account?
      </h2>
      <div className="explanation" style={{ textAlign: 'left' }}>
        <p>This cannot be undone.</p>
        <p>
          <b>Removed:</b> your username, email, password, avatar, friends, achievements and activity. You will be signed
          out everywhere.
        </p>
        <p>
          <b>Kept, without your name:</b> your past runs and scores, which stay on leaderboards and in other players&rsquo;
          duel history as &ldquo;Deleted player&rdquo;.
        </p>
      </div>
      <form className="start-form" onSubmit={submit} style={{ textAlign: 'left' }}>
        <label htmlFor="delete-confirm-name">
          Type <b>{username}</b> to confirm
          <input id="delete-confirm-name" type="text" autoComplete="off" autoCapitalize="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        <label htmlFor="delete-confirm-password">
          Your password
          <input id="delete-confirm-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={pending || !nameMatches || !password}>
            {pending ? 'Deleting…' : 'Delete my account'}
          </button>
          <button type="button" className="secondary-button" disabled={pending} onClick={onClose}>
            Keep my account
          </button>
        </div>
      </form>
    </Modal>
  );
}
