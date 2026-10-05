import { useState } from 'react';
import Plate from './Plate.jsx';
import { requestDeletionLink } from '../api/recovery.js';

/**
 * How to delete an account, for anyone — signed in or not — including someone who cannot log in. The in-app
 * way needs a password; this one needs only the email address, and sends a link that has to be opened and
 * confirmed. Linked from the foot of every page, which is also the address app stores ask for.
 */
export default function DeletionInfo({ mailEnabled, onBack }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');

  const submit = async (event) => {
    event.preventDefault();
    setState('sending');
    try {
      await requestDeletionLink(email);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Your Data</p>
          <h2 className="screen-title">Delete your account</h2>
        </div>
      </div>
      <Plate>
        <div className="start-form">
          <p className="plate-subhead">What deleting does</p>
          <p className="explanation">
            It removes your name, email address, password, avatar, bio, friends, blocks, achievements, activity and all
            your Owl Post messages. Your game scores stay, without your name, shown as &ldquo;Deleted player&rdquo;. It
            cannot be undone.
          </p>

          <p className="plate-subhead">If you can log in</p>
          <p className="explanation">Open the account menu, choose Settings, and use &ldquo;Delete my account&rdquo; at the foot of the page.</p>

          <p className="plate-subhead">If you cannot</p>
          {!mailEnabled ? (
            <p className="explanation">
              Email is not set up on this copy of the app yet, so a link cannot be sent. Please contact us through the
              Submit Feedback link at the foot of the page, without including personal details.
            </p>
          ) : state === 'sent' ? (
            <p role="status">If that address has an account, we have sent a link to confirm deleting it. It works for an hour.</p>
          ) : (
            <form className="start-form" onSubmit={submit}>
              <p className="explanation">Enter the email address you registered with and we will send you a link to confirm.</p>
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
                {state === 'sending' ? 'Sending…' : 'Send me the link'}
              </button>
            </form>
          )}
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        </div>
      </Plate>
    </div>
  );
}
