import { useState } from 'react';
import Plate from './Plate.jsx';
import DeleteAccountModal from './DeleteAccountModal.jsx';

export default function DeleteAccountSection({ username, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Delete Account
      </p>
      <p className="explanation" style={{ margin: '0 0 1rem' }}>
        Remove your name, email, friends and achievements from the archive. Your past scores stay, without your name.
      </p>
      <button type="button" className="icon-button icon-button--danger icon-button--labelled" onClick={() => setOpen(true)}>
        Delete my account
      </button>
      {open && <DeleteAccountModal username={username} onDelete={onDelete} onClose={() => setOpen(false)} />}
    </Plate>
  );
}
