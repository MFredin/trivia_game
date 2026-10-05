import { useState } from 'react';
import Plate from './Plate.jsx';
import { confirmPasswordReset } from '../api/recovery.js';

/** Choosing a new password from the link in the email. */
export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (password !== again) {
      setError('Those two passwords are not the same.');
      return;
    }
    setState('saving');
    setError(null);
    try {
      await confirmPasswordReset({ token, password });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(
        err.code === 'password_too_short'
          ? 'Password needs to be at least 8 characters.'
          : err.code === 'invalid_token'
            ? 'This link has expired or has already been used. Ask for a new one.'
            : 'That did not go through. Try again.',
      );
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Archive Access</p>
          <h2 className="screen-title">Choose a new password</h2>
        </div>
      </div>
      <Plate>
        {state === 'done' ? (
          <div className="start-form" role="status">
            <p>Your password has been changed. You can log in with it now.</p>
            <button type="button" className="primary-button" onClick={onDone}>
              Log in
            </button>
          </div>
        ) : (
          <form className="start-form" onSubmit={submit}>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <label>
              New password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </label>
            <label>
              New password again
              <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" />
            </label>
            <button type="submit" className="primary-button" disabled={state === 'saving'}>
              {state === 'saving' ? 'Saving…' : 'Change password'}
            </button>
          </form>
        )}
      </Plate>
    </div>
  );
}
