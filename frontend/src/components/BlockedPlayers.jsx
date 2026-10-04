import { useState } from 'react';
import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';

export default function BlockedPlayers({ blocked, loaded, loadError, onUnblock }) {
  const [error, setError] = useState(null);

  const unblock = async (username) => {
    setError(null);
    try {
      await onUnblock(username);
    } catch {
      setError(`Could not unblock ${username}. Try again.`);
    }
  };

  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        Blocked Players
      </p>
      <p className="explanation" style={{ margin: '0 0 1rem' }}>
        A blocked player cannot find you, add you, challenge you or see your profile, and you cannot see theirs.
        They are not told. Unblocking does not make you friends again.
      </p>
      {loadError && (
        <div className="error-banner" role="alert">
          {loadError}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loaded && blocked.length === 0 && <p className="explanation">You have not blocked anyone.</p>}
      {blocked.length > 0 && (
        <ul className="friend-list">
          {blocked.map((b) => (
            <li key={b.username} className="friend-row">
              <span className="friend-name">
                <Avatar username={b.username} avatar={b.avatar} house={b.theme} size={32} />
                {b.username}
              </span>
              <button type="button" className="secondary-button" onClick={() => unblock(b.username)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Plate>
  );
}
