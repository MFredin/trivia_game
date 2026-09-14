import { HOUSES } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

export default function HouseCupBoard({ houses, unsorted }) {
  if (houses.length === 0) {
    return <p className="explanation">No completed runs yet — pick a house in Settings and start the cup.</p>;
  }

  return (
    <div>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>House</th>
            <th>Total Score</th>
            <th>Players</th>
          </tr>
        </thead>
        <tbody>
          {houses.map((h, index) => {
            const house = HOUSE_BY_ID[h.theme];
            return (
              <tr key={h.theme}>
                <td className="rank">{index + 1}</td>
                <td className="player" style={{ color: house?.brass, fontWeight: 700 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      background: house?.accent,
                      border: `1px solid ${house?.brass}`,
                      marginRight: '0.5rem',
                      verticalAlign: 'middle',
                    }}
                  />
                  {house?.label ?? h.theme}
                </td>
                <td className="score">{h.total_score}</td>
                <td className="score">{h.players}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {unsorted && unsorted.players > 0 && (
        <p className="explanation" style={{ marginTop: '1rem' }}>
          Plus {unsorted.players} player{unsorted.players === 1 ? '' : 's'} yet to choose a house (Monochrome),
          contributing {unsorted.total_score} unsorted points.
        </p>
      )}
    </div>
  );
}
