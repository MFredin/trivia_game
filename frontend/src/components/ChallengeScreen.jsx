import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import Leaderboard from './Leaderboard.jsx';
import { getChallenge } from '../api/client.js';

export default function ChallengeScreen({ code, token, onPlay, onCancel }) {
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getChallenge(code, token)
      .then(setChallenge)
      .catch(() => setError('That challenge link is no longer valid.'));
  }, [code, token]);

  const handlePlay = async () => {
    setStarting(true);
    try {
      await onPlay(code);
    } finally {
      setStarting(false);
    }
  };

  const entries =
    challenge?.leaderboard.map((r) => ({
      username: r.username,
      total_score: r.total_score,
      completed_at: r.completed_at,
      category: challenge.category,
    })) ?? [];

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Private Challenge</p>
          <h2 className="screen-title">
            {challenge ? `${challenge.created_by_username}'s Challenge` : 'Private Challenge'}
          </h2>
        </div>
        {onCancel && (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Not now
          </button>
        )}
      </div>

      {error && (
        <Plate>
          <p className="explanation">{error}</p>
        </Plate>
      )}

      {!error && !challenge && (
        <Plate>
          <p className="explanation">Fetching&hellip;</p>
        </Plate>
      )}

      {challenge && (
        <>
          <Plate>
            <p className="explanation" style={{ margin: 0 }}>
              {[challenge.category, challenge.difficulty].filter(Boolean).join(' · ') || 'All categories · Any difficulty'}
              {' — 10 questions, the same set for everyone who plays this link.'}
            </p>
          </Plate>
          <Plate>
            {entries.length === 0 ? (
              <p className="explanation">No one's played this challenge yet — be the first.</p>
            ) : (
              <Leaderboard entries={entries} />
            )}
          </Plate>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button type="button" className="primary-button" onClick={handlePlay} disabled={starting}>
              {starting ? 'Starting…' : 'Play this Challenge'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
