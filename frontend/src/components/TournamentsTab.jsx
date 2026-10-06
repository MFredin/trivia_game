// The Tournaments tab of the Community screen: the tournaments you are in, making one, and joining one by its code. Nothing
// here reaches you: a tournament waits on this tab until you choose to look (docs/tournament-brackets-plan.md).
import { useState } from 'react';
import { useTournaments } from '../features/tournaments/useTournaments.js';
import TournamentCreateForm from './TournamentCreateForm.jsx';

const STATUS_LABEL = { open: 'Gathering players', running: 'Under way', completed: 'Finished', cancelled: 'Cancelled' };

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export default function TournamentsTab({ token, active, canMake, onOpen }) {
  const t = useTournaments({ token, active });
  const [making, setMaking] = useState(false);
  const [code, setCode] = useState('');

  const create = async (settings) => {
    const made = await t.create(settings);
    if (made) onOpen(made);
  };
  const join = async (event) => {
    event.preventDefault();
    const joined = await t.join(code);
    if (joined) {
      setCode('');
      onOpen(joined);
    }
  };

  return (
    <div>
      {t.error && <div className="error-banner">{t.error}</div>}

      {making ? (
        <TournamentCreateForm busy={t.busy} onCreate={create} onCancel={() => setMaking(false)} />
      ) : (
        <div className="tournament-toolbar">
          {canMake ? (
            <button type="button" className="primary-button" onClick={() => setMaking(true)}>
              Make a tournament
            </button>
          ) : (
            <p className="explanation">You have challenges switched off, so you can join no tournaments and make none.</p>
          )}
          <form className="tournament-join" onSubmit={join}>
            <input
              type="text"
              className="friend-add-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Join with a code"
              aria-label="Tournament code"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={8}
            />
            <button type="submit" className="secondary-button" disabled={t.busy || code.trim() === ''}>
              Join
            </button>
          </form>
        </div>
      )}

      {!t.loaded ? (
        <p className="explanation">Loading&hellip;</p>
      ) : t.tournaments.length === 0 ? (
        <p className="explanation">No tournaments yet. Make one and share its code with friends, or join one with a code.</p>
      ) : (
        <ul className="friend-list tournament-list">
          {t.tournaments.map((x) => (
            <li key={x.code} className="friend-row tournament-row">
              <div className="tournament-row-main">
                <span className="tournament-row-name">{x.name}</span>
                <span className="tournament-row-note">
                  {STATUS_LABEL[x.status]} · {x.player_count} of {x.size} players
                  {x.status === 'running' && x.my_deadline && ` · your match is due ${when(x.my_deadline)}`}
                  {x.status === 'completed' && x.winner && ` · won by ${x.winner}`}
                </span>
              </div>
              <button type="button" className="secondary-button" onClick={() => onOpen(x.code)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
