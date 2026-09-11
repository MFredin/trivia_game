import { useEffect, useState } from 'react';
import Leaderboard from './Leaderboard.jsx';
import { getLeaderboard } from '../api/client.js';

const MODES = [
  { value: 'classic', label: 'Classic Quiz' },
  { value: 'daily', label: 'Daily Challenge' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'survival', label: 'Survival' },
];

export default function LeaderboardScreen({ categories, token, onBack }) {
  const [mode, setMode] = useState('classic');
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [scope, setScope] = useState('global');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(mode, { category: category || null, canonSource: canonSource || null, difficulty: difficulty || null, scope }, token)
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [mode, category, canonSource, difficulty, scope, token]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Leaderboard</h2>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="start-form" style={{ marginBottom: '1.25rem' }}>
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
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Any difficulty</option>
            <option value="First Year">First Year</option>
            <option value="O.W.L.">O.W.L.</option>
            <option value="N.E.W.T.">N.E.W.T.</option>
            <option value="Order of the Phoenix">Order of the Phoenix</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="secondary-button"
            style={scope === 'global' ? { borderColor: 'var(--brass-500)', color: 'var(--brass-500)' } : undefined}
            onClick={() => setScope('global')}
          >
            Global
          </button>
          <button
            type="button"
            className="secondary-button"
            style={scope === 'friends' ? { borderColor: 'var(--brass-500)', color: 'var(--brass-500)' } : undefined}
            onClick={() => setScope('friends')}
          >
            Friends
          </button>
        </div>
      </div>

      {loading ? <p className="explanation">Loading…</p> : <Leaderboard entries={entries} />}
    </div>
  );
}
