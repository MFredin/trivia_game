import { useState } from 'react';
import FriendsPanel from './FriendsPanel.jsx';

export default function StartScreen({ categories, currentUser, token, onStart, onLogout, error }) {
  const [mode, setMode] = useState('classic');
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('combined');
  const [difficulty, setDifficulty] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart({
      mode,
      category: mode === 'daily' || category === '' ? null : category,
      canonSource: mode === 'daily' ? 'combined' : canonSource,
      difficulty: mode === 'daily' || difficulty === '' ? null : difficulty,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span className="explanation">Playing as {currentUser.username}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <FriendsPanel token={token} />
          <button type="button" className="secondary-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
      <form className="start-form" onSubmit={handleSubmit}>
        {error && <div className="error-banner">{error}</div>}
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="classic">Classic Quiz</option>
            <option value="daily">Daily Challenge</option>
            <option value="blitz">Blitz (60s, race the clock)</option>
            <option value="survival">Survival (one miss ends the run)</option>
          </select>
        </label>
        {mode !== 'daily' && (
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
          </>
        )}
        <button type="submit" className="primary-button">
          Begin
        </button>
      </form>
    </div>
  );
}
