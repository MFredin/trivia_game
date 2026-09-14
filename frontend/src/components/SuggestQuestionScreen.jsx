import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { getMySuggestions, submitSuggestion } from '../api/client.js';

const STATUS_LABEL = {
  pending: 'Awaiting review',
  approved: 'Approved — live in the archive',
  rejected: 'Not accepted',
};

export default function SuggestQuestionScreen({ categories, token }) {
  const [category, setCategory] = useState(categories[0] ?? '');
  const [questionText, setQuestionText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [distractors, setDistractors] = useState(['', '', '']);
  const [books, setBooks] = useState(true);
  const [movies, setMovies] = useState(true);
  const [divergence, setDivergence] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [sourceRef, setSourceRef] = useState('');

  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [mine, setMine] = useState([]);

  const refreshMine = () => {
    getMySuggestions(token)
      .then((data) => setMine(data.suggestions))
      .catch(() => {});
  };

  useEffect(refreshMine, [token]);

  const resetForm = () => {
    setQuestionText('');
    setCorrectAnswer('');
    setDistractors(['', '', '']);
    setExplanation('');
    setSourceRef('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const canonTags = [books && 'book', movies && 'movie'].filter(Boolean);
    if (canonTags.length === 0) {
      setError('Pick at least one of Books or Movies.');
      return;
    }
    if (distractors.some((d) => d.trim().length === 0)) {
      setError('All three wrong answers need something in them.');
      return;
    }
    try {
      await submitSuggestion(
        {
          category,
          question_text: questionText,
          correct_answer: correctAnswer,
          distractors,
          canon_tags: canonTags,
          divergence,
          explanation: explanation || null,
          source_ref: sourceRef || null,
        },
        token,
      );
      resetForm();
      setSubmitted(true);
      refreshMine();
    } catch (err) {
      setError('Could not submit that — check every field and try again.');
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Restricted Shelf</p>
          <h2 className="screen-title has-dropcap">Suggest a Question</h2>
        </div>
      </div>

      <Plate>
        {error && <div className="error-banner">{error}</div>}
        {submitted && !error && (
          <div className="explanation" style={{ marginBottom: '1rem' }}>
            Submitted — an admin will review it before it ever reaches another player.
          </div>
        )}
        <form className="start-form" onSubmit={handleSubmit}>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              required
              minLength={10}
              maxLength={500}
            />
          </label>
          <label>
            Correct answer
            <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required />
          </label>
          {distractors.map((value, index) => (
            <label key={index}>
              Wrong answer {index + 1}
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  setDistractors((prev) => prev.map((d, i) => (i === index ? e.target.value : d)))
                }
                required
              />
            </label>
          ))}
          <div className="start-form-field">
            <span className="field-label">Applies to</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginRight: '1.2rem' }}>
              <input type="checkbox" checked={books} onChange={(e) => setBooks(e.target.checked)} />
              Books
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={movies} onChange={(e) => setMovies(e.target.checked)} />
              Movies
            </label>
          </div>
          <div className="start-form-field">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={divergence} onChange={(e) => setDivergence(e.target.checked)} />
              This is specifically about a book/movie difference
            </label>
          </div>
          <label>
            Explanation (optional)
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={400} />
          </label>
          <label>
            Source (optional)
            <input type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          </label>
          <button type="submit" className="primary-button">
            Submit for Review
          </button>
        </form>
      </Plate>

      {mine.length > 0 && (
        <Plate className="friend-section">
          <h3 className="plate-subhead">Your Submissions</h3>
          <ul className="friend-list">
            {mine.map((s) => (
              <li key={s.id} className="friend-row">
                <span className="friend-name">{s.question_text}</span>
                <span className="friend-actions">
                  <span className="explanation">{STATUS_LABEL[s.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Plate>
      )}
    </div>
  );
}
