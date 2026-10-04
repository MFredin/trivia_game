import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';
import { AVATAR_SIGILS } from '../constants/avatarSigils.js';

export default function AvatarPicker({ user, onSelect, error }) {
  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Your Sigil
      </p>
      <div className="avatar-picker-preview">
        <Avatar username={user.username} avatar={user.avatar} house={user.theme} size={64} label="Your avatar" />
        <p className="explanation">
          The mark other players see beside your name. It sits on your house colours, so it changes with your binding.
        </p>
      </div>
      <div className="avatar-picker-grid" role="group" aria-label="Choose a sigil">
        <button
          type="button"
          className={`avatar-option ${user.avatar ? '' : 'is-active'}`}
          aria-pressed={!user.avatar}
          aria-label="Your initial"
          onClick={() => onSelect(null)}
        >
          <Avatar username={user.username} avatar={null} house={user.theme} size={40} />
        </button>
        {AVATAR_SIGILS.map((sigil) => (
          <button
            key={sigil.id}
            type="button"
            className={`avatar-option ${user.avatar === sigil.id ? 'is-active' : ''}`}
            aria-pressed={user.avatar === sigil.id}
            aria-label={sigil.label}
            title={sigil.label}
            onClick={() => onSelect(sigil.id)}
          >
            <Avatar username={user.username} avatar={sigil.id} house={user.theme} size={40} />
          </button>
        ))}
      </div>
      {error && (
        <div className="error-banner" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </Plate>
  );
}
