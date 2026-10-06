// A tournament's bracket: every round, every match, and the places later rounds will fill. The same data is drawn two ways by
// CSS alone (styles/parts/tournaments.css): a tree of columns where there is room, and stacked rounds where there is not, so
// a phone never gets a squeezed tree. It is an ordered list of rounds, each an ordered list of matches, so a screen reader
// reads it in the order a person would, and colour is never the only signal: an advancing player is labelled, a knocked-out
// one is struck through, a bye and a no-show say so.
import TableScroll from './TableScroll.jsx';

const roundName = (round, rounds) =>
  round === rounds ? 'Final' : round === rounds - 1 ? 'Semi-finals' : round === rounds - 2 ? 'Quarter-finals' : `Round ${round}`;

const DECIDED_BY = { no_show: 'No show', forfeit: 'Forfeit', time: 'Won on time', seed: 'Won on seed' };

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

function Side({ player, won, lost, score }) {
  if (!player) {
    return (
      <div className="bracket-side is-empty">
        <span className="bracket-name">To be decided</span>
      </div>
    );
  }
  return (
    <div className={`bracket-side ${won ? 'is-winner' : ''} ${lost ? 'is-loser' : ''} ${player.is_me ? 'is-me' : ''}`}>
      <span className="bracket-seed" title={`Seed ${player.seed}`}>{player.seed}</span>
      <span className="bracket-name">
        {player.username}
        {player.is_me && <span className="bracket-you"> (you)</span>}
      </span>
      {score != null && <span className="bracket-score">{score}</span>}
      {won && <span className="bracket-tag">Advanced</span>}
    </div>
  );
}

function Match({ match }) {
  if (!match) {
    return (
      <li className="bracket-match is-pending">
        <Side player={null} />
        <Side player={null} />
      </li>
    );
  }
  const decided = match.status === 'decided';
  return (
    <li className={`bracket-match ${decided ? 'is-decided' : 'is-open'}`}>
      <Side player={match.player_a} won={match.winner === 'a'} lost={match.winner === 'b'} score={match.score_a} />
      {match.is_bye ? (
        <div className="bracket-note">Bye</div>
      ) : (
        <Side player={match.player_b} won={match.winner === 'b'} lost={match.winner === 'a'} score={match.score_b} />
      )}
      <div className="bracket-note">
        {decided
          ? DECIDED_BY[match.decided_by] ?? ''
          : match.deadline
            ? `Play by ${when(match.deadline)}`
            : ''}
        {match.under_review && <span className="bracket-review"> · Under review</span>}
      </div>
    </li>
  );
}

export default function TournamentBracket({ tournament }) {
  const rounds = Math.log2(tournament.bracket_size);
  const columns = Array.from({ length: rounds }, (_, i) => {
    const round = i + 1;
    const slots = tournament.bracket_size / 2 ** round;
    const matches = Array.from({ length: slots }, (_, s) => tournament.matches.find((m) => m.round === round && m.slot === s + 1) ?? null);
    return { round, matches };
  });

  return (
    <TableScroll label="Bracket">
      <ol className="bracket">
        {columns.map(({ round, matches }) => (
          <li key={round} className="bracket-round">
            <h4 className="bracket-round-title">{roundName(round, rounds)}</h4>
            <ol className="bracket-matches">
              {matches.map((match, i) => (
                <Match key={match?.id ?? `${round}-${i}`} match={match} />
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </TableScroll>
  );
}
