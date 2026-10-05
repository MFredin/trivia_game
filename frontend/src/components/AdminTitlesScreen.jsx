import { useState } from 'react';
import Plate from './Plate.jsx';
import IconButton from './IconButton.jsx';
import { useAdminTitles } from '../features/titles/useAdminTitles.js';

export default function AdminTitlesScreen({ token }) {
  const { holders, available, error, notice, busy, grant, revoke } = useAdminTitles({ token });
  const [username, setUsername] = useState('');
  const [chosen, setChosen] = useState('');
  // Until one is picked, the first on offer; what can be given comes from the server.
  const title = chosen || available[0]?.id || '';

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || busy) return;
    if (await grant(username.trim(), title)) setUsername('');
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Admin</p>
          <h2 className="screen-title">Titles</h2>
        </div>
      </div>

      <Plate>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          Give a player a title that only you can give. It is a label beside their name, not a permission: it does
          not make anyone a moderator. They choose whether to wear it, and you can take it back.
        </p>
        <form className="friend-add-form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="grant-username">
            Player name
          </label>
          <input
            id="grant-username"
            type="text"
            className="friend-add-input"
            placeholder="Player name"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="visually-hidden" htmlFor="grant-title">
            Title
          </label>
          <select id="grant-title" className="friend-add-input" value={title} onChange={(e) => setChosen(e.target.value)}>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.description}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-button" disabled={!username.trim() || !title || busy}>
            Grant
          </button>
        </form>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <p className="explanation" role="status">
            {notice}
          </p>
        )}
      </Plate>

      <Plate>
        <h3 className="plate-subhead">Who holds one</h3>
        {holders === null && <p className="explanation">Fetching&hellip;</p>}
        {holders && holders.length === 0 && <p className="explanation">No one yet.</p>}
        {holders && holders.length > 0 && (
          <ul className="friend-list">
            {holders.map((h) => (
              <li key={`${h.username}-${h.title}`} className="friend-row">
                <span className="friend-name">
                  {h.username} <span className="player-title player-title--system">{h.title_name}</span>
                  <span className="member-caption">given by {h.granted_by ?? 'an admin'}</span>
                </span>
                <IconButton icon="x" label="Take back" showLabel disabled={busy} onClick={() => revoke(h.username, h.title)} />
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
