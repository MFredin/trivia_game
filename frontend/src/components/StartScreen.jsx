import { useState } from 'react';

export default function StartScreen({ categories, onStart, error }) {
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState('classic');
  const [category, setCategory] = useState('');
  const [canonSource, setCanonSource] = useState('combined');

  const handleSubmit = (event) => {
    event.preventDefault();
    onStart({
      username,
      mode,
      category: mode === 'daily' || category === '' ? null : category,
      canonSource: mode === 'daily' ? 'combined' : canonSource,
    });
  };

  return (
    <form className="start-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <label>
        Player name
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          required
          maxLength={40}
        />
      </label>
      <label>
        Mode
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="classic">Classic Quiz</option>
          <option value="daily">Daily Challenge</option>
        </select>
      </label>
      {mode === 'classic' && (
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
        </>
      )}
      <button type="submit" className="primary-button">
        Begin
      </button>
    </form>
  );
}
