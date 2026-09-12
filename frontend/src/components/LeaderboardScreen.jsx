import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import Leaderboard from './Leaderboard.jsx';
import DuelLeaderboard from './DuelLeaderboard.jsx';
import DifficultySlider from './DifficultySlider.jsx';
import { getDuelLeaderboard, getLeaderboard } from '../api/client.js';

const MODES = [
  { value: 'classic', label: 'Classic Quiz' },
  { value: 'daily', label: 'Daily Challenge' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'survival', label: 'Survival' },
  { value: 'gauntlet', label: 'Gauntlet' },
  { value: 'duel', label: 'Duels' },
];

export default function LeaderboardScreen({ categories, token }) {
  const [mode, setMode] = useState('classic');
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [scope, setScope] = useState('global');
  const [window, setWindow] = useState('current');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const isDuelBoard = mode === 'duel';

  useEffect(() => {
    setLoading(true);
    if (isDuelBoard) {
      getDuelLeaderboard(scope, token)
        .then((data) => setEntries(data.entries))
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
      return;
    }
    getLeaderboard(
      mode,
      { category: category || null, canonSource: canonSource || null, difficulty: difficulty || null, scope, window },
      token,
    )
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [mode, category, canonSource, difficulty, scope, window, token, isDuelBoard]);

  const currentLabel = mode === 'daily' ? 'Today' : 'This Week';

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">The Ledger</p>
          <h2 className="screen-title">Leaderboard</h2>
        </div>
        <div className="nav-links">
          {!isDuelBoard && (
            <>
              <button
                type="button"
                className={`nav-btn ${window === 'current' ? 'is-active' : ''}`}
                onClick={() => setWindow('current')}
              >
                {currentLabel}
              </button>
              <button
                type="button"
                className={`nav-btn ${window === 'all' ? 'is-active' : ''}`}
                onClick={() => setWindow('all')}
              >
                All Time
              </button>
              <span style={{ width: '1px', background: 'rgba(237,230,214,0.16)', margin: '0 0.2rem' }} />
            </>
          )}
          <button
            type="button"
            className={`nav-btn ${scope === 'global' ? 'is-active' : ''}`}
            onClick={() => setScope('global')}
          >
            Global
          </button>
          <button
            type="button"
            className={`nav-btn ${scope === 'friends' ? 'is-active' : ''}`}
            onClick={() => setScope('friends')}
          >
            Friends
          </button>
        </div>
      </div>

      <Plate>
        <div className="start-form leaderboard-filters">
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {!isDuelBoard && (
            <>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Canon source
                <select value={canonSource} onChange={(e) => setCanonSource(e.target.value)}>
                  <option value="">Any</option>
                  <option value="combined">Combined</option>
                  <option value="books">Books</option>
                  <option value="movies">Movies</option>
                </select>
              </label>
              <div className="start-form-field">
                <span className="field-label">Difficulty</span>
                <DifficultySlider value={difficulty} onChange={setDifficulty} />
              </div>
            </>
          )}
        </div>

        <div className="ledger-divider" />

        {loading ? (
          <p className="explanation">Loading…</p>
        ) : isDuelBoard ? (
          <DuelLeaderboard entries={entries} />
        ) : (
          <Leaderboard entries={entries} />
        )}
      </Plate>
    </div>
  );
}
