// A mode's top-scores table (rank in Roman numerals, player and title, score, category). Rows are data from
// /api/leaderboard; it can scroll sideways inside itself if it cannot fit (TableScroll).
import { toRoman } from '../lib/roman.js';

import TableScroll from './TableScroll.jsx';
import PlayerTitle from './PlayerTitle.jsx';

export default function Leaderboard({ entries }) {
  if (entries.length === 0) {
    return <p className="explanation">No completed runs yet — be the first on the board.</p>;
  }

  return (
    <TableScroll label="Leaderboard">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Score</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.username}-${entry.completed_at}`}>
              <td className="rank">{toRoman(index + 1)}</td>
              <td className="player">
                {entry.username}
                <PlayerTitle title={entry.title} className="player-title--inline" />
              </td>
              <td className="score">{entry.total_score}</td>
              <td className="category">{entry.category ?? 'All'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
