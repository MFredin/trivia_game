export default function DuelLeaderboard({ entries }) {
  if (entries.length === 0) {
    return <p className="explanation">No completed duels yet — challenge someone to get on the board.</p>;
  }

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Wins</th>
          <th>Losses</th>
          <th>Win %</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr key={entry.username}>
            <td className="rank">{index + 1}</td>
            <td className="player">{entry.username}</td>
            <td className="score">{entry.wins}</td>
            <td className="score">{entry.losses}</td>
            <td className="score">{entry.win_pct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
