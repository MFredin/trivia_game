import { useState } from 'react';
import Plate from './Plate.jsx';

const MIN_LENGTH = 8;

export default function PasswordSettings({ onChangePassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaved(false);
    if (next.length < MIN_LENGTH) {
      setError(`The new password needs at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== again) {
      setError('The two new passwords do not match.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await onChangePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setAgain('');
      setSaved(true);
    } catch (err) {
      if (err.code === 'incorrect_password') setError('That is not your current password.');
      else if (err.code === 'too_many_attempts') setError('Too many attempts — try again in a little while.');
      else setError('Could not change your password. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Change Password
      </p>
      <p className="explanation" style={{ margin: '0 0 1rem' }}>
        Changing it signs you out on every other device.
      </p>
      <form className="start-form" onSubmit={submit}>
        <label htmlFor="current-password">
          Current password
          <input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label htmlFor="new-password">
          New password
          <input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label htmlFor="new-password-again">
          New password again
          <input id="new-password-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {saved && (
          <p className="explanation" role="status" style={{ margin: 0 }}>
            Password changed.
          </p>
        )}
        <div>
          <button type="submit" className="secondary-button" disabled={pending || !current || !next}>
            {pending ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </Plate>
  );
}
