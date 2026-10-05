import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { confirmDeletion, previewDeletion } from '../api/recovery.js';

/** The page the deletion link opens: whose account it is, and one button that does it. */
export default function ConfirmDeletion({ token, onDone }) {
  const [username, setUsername] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    previewDeletion(token)
      .then((data) => {
        setUsername(data.username);
        setState('ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const confirm = async () => {
    setState('working');
    try {
      await confirmDeletion(token);
      setState('done');
    } catch {
      setState('invalid');
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
        <div className="start-form" role="status">
          {state === 'loading' && <p className="explanation">Checking the link&hellip;</p>}
          {state === 'invalid' && (
            <>
              <p>This link has expired or has already been used. Ask for a new one from the Delete your account page.</p>
              <button type="button" className="secondary-button" onClick={onDone}>
                Back
              </button>
            </>
          )}
          {(state === 'ready' || state === 'working') && (
            <>
              <p>
                Delete the account <b>{username}</b>? This removes your name, email, friends, messages and achievements.
                It cannot be undone.
              </p>
              <button type="button" className="primary-button" disabled={state === 'working'} onClick={confirm}>
                {state === 'working' ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button type="button" className="secondary-button" disabled={state === 'working'} onClick={onDone}>
                No, keep it
              </button>
            </>
          )}
          {state === 'done' && (
            <>
              <p>Your account has been deleted.</p>
              <button type="button" className="secondary-button" onClick={onDone}>
                Done
              </button>
            </>
          )}
        </div>
      </Plate>
    </div>
  );
}
