// One tournament: who is in it, where it stands, your next match, and the bracket. The server decides everything; this screen
// reads it (and re-reads it after every action) and offers the few things a player or the creator may do.
import { useState } from 'react';
import Plate from './Plate.jsx';
import TournamentBracket from './TournamentBracket.jsx';
import { useTournament } from '../features/tournaments/useTournament.js';
import { tournamentMessage } from '../features/tournaments/tournamentMessages.js';

const CANON_LABEL = { combined: 'books and films', books: 'the books', movies: 'the films' };

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });

function statusLine(v) {
  if (v.status === 'open') return 'Gathering players';
  if (v.status === 'cancelled') return 'Cancelled';
  if (v.status === 'completed') return `Champion: ${v.winner ?? 'unknown'}`;
  return `Round ${v.current_round} of ${Math.log2(v.bracket_size)}`;
}

function NextMatch({ v, onPlay, playing }) {
  const me = v.players.find((p) => p.is_me);
  const mine = v.matches.find((m) => m.my_state);
  if (v.status !== 'running') return null;

  if (!mine) {
    return (
      <p className="explanation">
        {me?.eliminated_in_round
          ? `You were knocked out in round ${me.eliminated_in_round}.`
          : 'Nothing for you to play right now. The other matches in this round are still being played.'}
      </p>
    );
  }
  const opponent = mine.player_a?.is_me ? mine.player_b : mine.player_a;
  const against = opponent?.username ?? 'your opponent';

  if (mine.my_state === 'to_play') {
    return (
      <div className="tournament-next">
        <p className="explanation">
          Your match against <b>{against}</b> is open. Play it by <b>{when(mine.deadline)}</b>. You can only start it once, and
          you both answer the same ten questions.
        </p>
        <button type="button" className="primary-button" disabled={playing} onClick={() => onPlay(mine.id)}>
          {playing ? 'Starting…' : 'Play your match'}
        </button>
      </div>
    );
  }
  if (mine.my_state === 'started') {
    return (
      <p className="explanation">
        You started your match against <b>{against}</b> but did not finish it. It cannot be restarted: at the deadline it counts
        with the answers you gave.
      </p>
    );
  }
  return (
    <p className="explanation">
      You have played your match against <b>{against}</b>. It is decided when they have played, or by <b>{when(mine.deadline)}</b>.
    </p>
  );
}

export default function TournamentScreen({ code, token, onBack, onPlayMatch }) {
  const t = useTournament({ code, token });
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const v = t.tournament;

  const play = async (matchId) => {
    setPlaying(true);
    setPlayError(null);
    try {
      await onPlayMatch(matchId);
    } catch (err) {
      setPlayError(tournamentMessage(err));
      await t.reload();
    } finally {
      setPlaying(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // the code is on the screen to be read out or copied by hand
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Tournament</p>
          <h2 className="screen-title">{v?.name ?? 'Tournament'}</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
      </div>

      {t.error && <div className="error-banner">{t.error}</div>}
      {playError && <div className="error-banner">{playError}</div>}
      {!v && !t.error && (
        <Plate>
          <p className="explanation">Fetching&hellip;</p>
        </Plate>
      )}

      {v && (
        <>
          <Plate>
            <h3 className="plate-subhead tournament-status">{statusLine(v)}</h3>
            <p className="tournament-note">
              Questions from {CANON_LABEL[v.canon_source] ?? 'the books and films'} · {v.round_hours} hours a round · ten questions a match
              · made by {v.created_by}
            </p>

            {v.status === 'open' && (
              <>
                <p className="explanation">
                  {v.players.length} of {v.size} players are in. Share this code with whoever should join:
                </p>
                <div className="tournament-code-row">
                  <code className="tournament-code" aria-label="Tournament code">{code}</code>
                  <button type="button" className="secondary-button" onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            )}

            <NextMatch v={v} onPlay={play} playing={playing} />

            <div className="tournament-actions">
              {v.status === 'open' && v.is_creator && (
                <button type="button" className="primary-button" disabled={t.busy || v.players.length < 3} onClick={t.start}>
                  {v.players.length < 3 ? 'Start (needs three players)' : 'Start the tournament'}
                </button>
              )}
              {v.status === 'open' && !v.is_creator && (
                <button type="button" className="secondary-button" disabled={t.busy} onClick={async () => { if (await t.leave()) onBack(); }}>
                  Leave
                </button>
              )}
              {['open', 'running'].includes(v.status) && v.is_creator && (
                confirmingCancel ? (
                  <button type="button" className="secondary-button" disabled={t.busy} onClick={async () => { await t.cancel(); setConfirmingCancel(false); }}>
                    Really cancel it?
                  </button>
                ) : (
                  <button type="button" className="secondary-button" onClick={() => setConfirmingCancel(true)}>
                    Cancel the tournament
                  </button>
                )
              )}
            </div>
          </Plate>

          {v.status === 'open' ? (
            <Plate>
              <h3 className="plate-subhead">Players</h3>
              <ul className="friend-list">
                {v.players.map((p) => (
                  <li key={p.username} className="friend-row tournament-row">
                    <span className="tournament-row-name">
                      {p.username}
                      {p.is_me && ' (you)'}
                    </span>
                    {v.is_creator && !p.is_me && (
                      <button type="button" className="secondary-button" disabled={t.busy} onClick={() => t.removePlayer(p.username)}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Plate>
          ) : v.bracket_size ? (
            <Plate>
              <TournamentBracket tournament={v} />
            </Plate>
          ) : null}
        </>
      )}
    </div>
  );
}
