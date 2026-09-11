import { useState } from 'react';
import Plate from './Plate.jsx';
import DifficultySlider from './DifficultySlider.jsx';

export default function DuelLobbyScreen({ opponentUsername, categories, outgoingDuel, error, onSend, onLeave }) {
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('combined');
  const [difficulty, setDifficulty] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSend({ category: category || null, canonSource, difficulty: difficulty || null });
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Challenge</p>
          <h2 className="screen-title">Duel {opponentUsername}</h2>
        </div>
      </div>
      <Plate>
        {error && <div className="error-banner">{error}</div>}
        {outgoingDuel ? (
          <div style={{ textAlign: 'center' }}>
            <p className="explanation">Waiting for {opponentUsername} to accept your challenge&hellip;</p>
            <button type="button" className="secondary-button" onClick={onLeave}>
              Back to Friends
            </button>
          </div>
        ) : (
          <form className="start-form" onSubmit={handleSubmit}>
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
            <div className="start-form-field">
              <span className="field-label">Difficulty</span>
              <DifficultySlider value={difficulty} onChange={setDifficulty} />
            </div>
            <button type="submit" className="primary-button">
              Send Challenge
            </button>
            <button type="button" className="secondary-button" onClick={onLeave}>
              Cancel
            </button>
          </form>
        )}
      </Plate>
    </div>
  );
}
