import HouseDevice from './HouseDevice.jsx';
import { toRoman } from '../lib/roman.js';
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
                <td className="rank">{toRoman(index + 1)}</td>
                <td className="player" style={{ color: house?.brass, fontWeight: 700 }}>
                  <HouseDevice
                    house={h.theme}
                    size={18}
                    className="house-cup-device"
                    /* This board shows all five houses side by side regardless of the
                       viewer's own binding, so the device takes that house's own colour
                       directly rather than the (viewer-scoped) --onbg/--rubric tokens. */
                  />
                  <span style={{ marginLeft: '0.5rem' }}>{house?.label ?? h.theme}</span>
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
