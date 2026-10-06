import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Shown, and unavoidable, to a player a moderator has renamed: the name they had was taken away, so
 * they pick another before doing anything else. It is the one time the app lets a name change.
 */
export default function RenameModal({ onRename }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onRename(username.trim());
    } catch (err) {
      if (err.code === 'username_taken') setError('Someone already has that name. Try another.');
      else if (err.code === 'invalid_username') setError('Choose a name up to 40 characters that is not a reserved one.');
      else setError('Could not save that name. Try again.');
      setPending(false);
    }
  };

  return (
    <Modal onClose={() => {}} labelledBy="rename-title">
      <p className="screen-eyebrow">Choose a New Name</p>
      <h2 className="screen-title" id="rename-title">
        Your name was changed
      </h2>
      <p className="explanation">
        A moderator changed your name because it broke the house rules. Pick a new one to carry on — it is the only time
        this can be changed.
      </p>
      <form className="start-form" onSubmit={submit} style={{ textAlign: 'left' }}>
        <label htmlFor="new-username">
          New name
          <input id="new-username" type="text" maxLength={40} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={pending || username.trim().length === 0}>
            {pending ? 'Saving…' : 'Use this name'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
