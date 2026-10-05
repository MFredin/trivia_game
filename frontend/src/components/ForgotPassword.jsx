import { useState } from 'react';
import Plate from './Plate.jsx';
import { requestPasswordReset } from '../api/recovery.js';

/** Asking for a reset link. The answer is the same whether or not the address has an account. */
export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');

  const submit = async (event) => {
    event.preventDefault();
    setState('sending');
    try {
      await requestPasswordReset(email);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Archive Access</p>
          <h2 className="screen-title">Forgot your password?</h2>
        </div>
      </div>
      <Plate>
        {state === 'sent' ? (
          <div className="start-form" role="status">
            <p>If that address has an account, we have sent a link to choose a new password. It works for an hour.</p>
            <button type="button" className="secondary-button" onClick={onBack}>
              Back to log in
            </button>
          </div>
        ) : (
          <form className="start-form" onSubmit={submit}>
            <p className="explanation">Enter the email address you registered with and we will send you a link.</p>
            {state === 'error' && (
              <div className="error-banner" role="alert">
                That did not go through. Check the address and try again.
              </div>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit" className="primary-button" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send the link'}
            </button>
            <button type="button" className="secondary-button" onClick={onBack}>
              Back to log in
            </button>
          </form>
        )}
      </Plate>
    </div>
  );
}
