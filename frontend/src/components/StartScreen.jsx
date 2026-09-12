import { useState } from 'react';
import Plate from './Plate.jsx';
import DifficultySlider from './DifficultySlider.jsx';

const MODE_INFO = {
  classic: {
    label: 'Classic Quiz',
    description: 'Ten questions, no clock pressure beyond the norm — one clean measure of what you know.',
  },
  daily: {
    label: 'Daily Challenge',
    description:
      'One shared set of ten questions for everyone today, refreshed at midnight. Everyone who plays sees the exact same run.',
  },
  blitz: {
    label: 'Blitz',
    description:
      'Sixty seconds, as many questions as you can answer. The clock never resets between questions — speed is the whole game.',
  },
  survival: {
    label: 'Survival',
    description: 'One wrong answer, or one timeout, ends the run. How far can you get before a single mistake stops you?',
  },
  gauntlet: {
    label: 'Gauntlet',
    description: "Three strikes and you're out — a little more forgiving than Survival, a lot more than Classic.",
  },
};

export default function StartScreen({ categories, currentUser, onStart, error }) {
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
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">New Enquiry</p>
          <h2 className="screen-title has-dropcap">Begin an Enquiry</h2>
        </div>
        <span className="explanation" style={{ margin: 0 }}>
          Playing as <b>{currentUser.username}</b>
        </span>
      </div>

      <Plate
        secondary={
          <div className="qcard-margin">
            <p className="qcard-margin-stat-label">Mode</p>
            <p className="qcard-margin-stat-value" style={{ fontSize: '1.15rem' }}>
              {MODE_INFO[mode].label}
            </p>
            <div className="qcard-margin-divider" style={{ marginTop: '0.8rem' }} />
            <p className="explanation" style={{ margin: 0 }}>
              {MODE_INFO[mode].description}
            </p>
          </div>
        }
      >
        <form className="start-form" onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="classic">Classic Quiz</option>
              <option value="daily">Daily Challenge</option>
              <option value="blitz">Blitz (60s, race the clock)</option>
              <option value="survival">Survival (one miss ends the run)</option>
              <option value="gauntlet">Gauntlet (three strikes)</option>
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
              <div className="start-form-field">
                <span className="field-label">Difficulty</span>
                <DifficultySlider value={difficulty} onChange={setDifficulty} />
              </div>
            </>
          )}
          <button type="submit" className="primary-button">
            Begin
          </button>
        </form>
      </Plate>
    </div>
  );
}
