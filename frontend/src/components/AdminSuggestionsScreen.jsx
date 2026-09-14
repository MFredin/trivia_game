import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { DIFFICULTY_TIERS } from '../constants/difficulty.js';
import { approveSuggestion, getAdminSuggestions, rejectSuggestion } from '../api/client.js';

const OBSCURITY_TIERS = DIFFICULTY_TIERS.map((t) => t.value).filter(Boolean);
const DESIGN_TIERS = ['Direct', 'Some distractors', 'Trick phrasing', 'Requires cross-referencing'];
const STATUSES = ['pending', 'approved', 'rejected'];

function draftFrom(suggestion) {
  return {
    category: suggestion.category,
    question_text: suggestion.question_text,
    correct_answer: suggestion.correct_answer,
    distractors: [...suggestion.distractors],
    obscurity_tier: suggestion.obscurity_tier ?? '',
    design_tier: suggestion.design_tier ?? '',
  };
}

export default function AdminSuggestionsScreen({ categories, token }) {
  const [status, setStatus] = useState('pending');
  const [suggestions, setSuggestions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const refresh = () => {
    getAdminSuggestions(status, token)
      .then((data) => setSuggestions(data.suggestions))
      .catch(() => setError('Could not load the review queue.'));
  };

  useEffect(refresh, [status, token]);

  const toggleExpand = (suggestion) => {
    if (expandedId === suggestion.id) {
      setExpandedId(null);
      setDraft(null);
      return;
    }
    setExpandedId(suggestion.id);
    setDraft(draftFrom(suggestion));
  };

  const handleApprove = async (id) => {
    setError(null);
    if (!OBSCURITY_TIERS.includes(draft.obscurity_tier) || !DESIGN_TIERS.includes(draft.design_tier)) {
      setError('Pick both a difficulty tier and a design tier before approving.');
      return;
    }
    try {
      await approveSuggestion(id, draft, token);
      setExpandedId(null);
      setDraft(null);
      refresh();
    } catch {
      setError('Could not approve that submission.');
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectSuggestion(id, 'Reviewed and declined', token);
      setExpandedId(null);
      setDraft(null);
      refresh();
    } catch {
      setError('Could not reject that submission.');
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Head of House</p>
          <h2 className="screen-title has-dropcap">Question Review</h2>
        </div>
        <div className="nav-links">
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`nav-btn ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Plate>
        {error && <div className="error-banner">{error}</div>}
        {suggestions.length === 0 ? (
          <p className="explanation">Nothing here right now.</p>
        ) : (
          <ul className="friend-list">
            {suggestions.map((s) => (
              <li key={s.id} style={{ display: 'block', padding: '0.9rem 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="friend-row" style={{ padding: 0 }}>
                  <span className="friend-name">
                    {s.question_text}
                    <span className="explanation" style={{ margin: '0.2rem 0 0' }}>
                      by {s.submitted_by} — {s.category}
                    </span>
                  </span>
                  <span className="friend-actions">
                    {s.status === 'pending' && (
                      <button type="button" className="secondary-button" onClick={() => toggleExpand(s)}>
                        {expandedId === s.id ? 'Close' : 'Review'}
                      </button>
                    )}
                    {s.status === 'rejected' && s.review_note && (
                      <span className="explanation">{s.review_note}</span>
                    )}
                    {s.status === 'approved' && <span className="explanation">→ {s.approved_question_id}</span>}
                  </span>
                </div>

                {expandedId === s.id && draft && (
                  <form className="start-form" style={{ marginTop: '1rem' }} onSubmit={(e) => e.preventDefault()}>
                    <label>
                      Category
                      <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
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
                        value={draft.question_text}
                        onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
                        rows={2}
                      />
                    </label>
                    <label>
                      Correct answer
                      <input
                        type="text"
                        value={draft.correct_answer}
                        onChange={(e) => setDraft({ ...draft, correct_answer: e.target.value })}
                      />
                    </label>
                    {draft.distractors.map((d, i) => (
                      <label key={i}>
                        Wrong answer {i + 1}
                        <input
                          type="text"
                          value={d}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              distractors: draft.distractors.map((x, idx) => (idx === i ? e.target.value : x)),
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Difficulty tier
                      <select
                        value={draft.obscurity_tier}
                        onChange={(e) => setDraft({ ...draft, obscurity_tier: e.target.value })}
                      >
                        <option value="">Choose one</option>
                        {OBSCURITY_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Design tier
                      <select value={draft.design_tier} onChange={(e) => setDraft({ ...draft, design_tier: e.target.value })}>
                        <option value="">Choose one</option>
                        {DESIGN_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button type="button" className="primary-button" onClick={() => handleApprove(s.id)}>
                        Approve
                      </button>
                      <button type="button" className="secondary-button" onClick={() => handleReject(s.id)}>
                        Reject
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
