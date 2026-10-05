// Admin only: who the moderators are, adding one by username (optionally with the Prefect title) and removing one.
// Admins themselves are made in the database, deliberately, so they do not appear here.
import { useState } from 'react';
import Plate from './Plate.jsx';
import Checkbox from './Checkbox.jsx';
import IconButton from './IconButton.jsx';
import PlayerTitle from './PlayerTitle.jsx';
import { useAdminTeam } from '../features/team/useAdminTeam.js';

const ROLE_LABEL = { admin: 'Admin', moderator: 'Moderator' };

export default function AdminTeamScreen({ token }) {
  const { team, error, notice, busy, change } = useAdminTeam({ token });
  const [username, setUsername] = useState('');
  const [giveTitle, setGiveTitle] = useState(true);

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || busy) return;
    if (await change(username.trim(), 'moderator', giveTitle)) setUsername('');
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Admin</p>
          <h2 className="screen-title">Team</h2>
        </div>
      </div>

      <Plate>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          A moderator reviews reports and acts on them: warnings, renames, clearing a bio or avatar, holding scores,
          muting, and suspending for up to a week. They cannot ban, suspend for longer, act on another moderator or an
          admin, review questions, or manage titles. Anything beyond what they can do, they send to you.
        </p>
        <form className="friend-add-form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="team-username">
            Player name
          </label>
          <input
            id="team-username"
            type="text"
            className="friend-add-input"
            placeholder="Player name"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" className="primary-button" disabled={!username.trim() || busy}>
            Make a moderator
          </button>
        </form>
        <label className="action-option" htmlFor="team-give-title">
          <Checkbox id="team-give-title" checked={giveTitle} onChange={() => setGiveTitle(!giveTitle)} />
          <span className="action-option-text">
            <span className="action-option-name">Also give the Prefect title</span>
            <span className="action-option-effect">A label beside their name. It goes when the role does.</span>
          </span>
        </label>
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
        <h3 className="plate-subhead">The team</h3>
        {team === null && <p className="explanation">Fetching&hellip;</p>}
        {team && team.length === 0 && <p className="explanation">No one yet.</p>}
        {team && team.length > 0 && (
          <ul className="friend-list">
            {team.map((member) => (
              <li key={member.username} className="friend-row">
                <span className="friend-name">
                  {member.username} <span className="member-caption">{ROLE_LABEL[member.role]}</span>
                  <PlayerTitle title={member.title} />
                </span>
                {member.role === 'moderator' && (
                  <IconButton icon="x" label="Remove as moderator" showLabel disabled={busy} onClick={() => change(member.username, 'player')} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
