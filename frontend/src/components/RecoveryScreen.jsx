import { useEffect, useState } from 'react';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';
import DeletionInfo from './DeletionInfo.jsx';
import ConfirmDeletion from './ConfirmDeletion.jsx';
import { getAuthOptions } from '../api/recovery.js';

/**
 * The pages that work without being logged in: asking for a password reset, choosing the new password from
 * the emailed link, how to delete an account (and doing it from an emailed link). One screen, four views,
 * chosen by `kind`, so the shell has one place to send people.
 */
export default function RecoveryScreen({ kind, token, onDone }) {
  const [mailEnabled, setMailEnabled] = useState(false);

  useEffect(() => {
    getAuthOptions()
      .then((data) => setMailEnabled(Boolean(data.mail_enabled)))
      .catch(() => setMailEnabled(false));
  }, []);

  if (kind === 'forgot') return <ForgotPassword onBack={onDone} />;
  if (kind === 'reset') return <ResetPassword token={token} onDone={onDone} />;
  if (kind === 'deletion-confirm') return <ConfirmDeletion token={token} onDone={onDone} />;
  return <DeletionInfo mailEnabled={mailEnabled} onBack={onDone} />;
}
