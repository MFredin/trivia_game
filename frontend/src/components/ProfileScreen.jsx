import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { getProfile } from '../api/client.js';
import { HOUSES } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

function Stat({ label, value }) {
  return (
    <div className="qcard-margin-stat" style={{ display: 'inline-block', marginRight: '2rem', marginBottom: '0.6rem' }}>
      <span className="qcard-margin-stat-label">{label}</span>
      <br />
      <span className="qcard-margin-stat-value">{value}</span>
    </div>
  );
}

export default function ProfileScreen({ username, token, onBack }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProfile(null);
    setError(null);
    getProfile(username, token)
      .then(setProfile)
      .catch(() => setError('Could not load that player file.'));
  }, [username, token]);

  const house = profile ? HOUSE_BY_ID[profile.theme] : null;

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Player File</p>
          <h2 className="screen-title">{username}</h2>
          {house && <span className="house-accent-bar" style={{ background: house.brass }} />}
        </div>
        {onBack && (
          <button type="button" className="secondary-button" onClick={onBack}>
            Back
          </button>
        )}
      </div>

      {error && (
        <Plate>
          <p className="explanation">{error}</p>
        </Plate>
      )}

      {!error && !profile && (
        <Plate>
          <p className="explanation">Fetching&hellip;</p>
        </Plate>
      )}

      {profile && (
        <>
          <Plate>
            <h3 className="plate-subhead">Lifetime</h3>
            <Stat label="Runs completed" value={profile.total_completed} />
            <Stat label="Questions answered" value={profile.total_questions_answered} />
            <Stat label="Accuracy" value={profile.accuracy_pct != null ? `${profile.accuracy_pct}%` : '—'} />
            <Stat label="Best single-run score" value={profile.best_score} />
            <Stat label="Longest in-run streak" value={profile.max_best_streak} />
            <Stat label="Favorite category" value={profile.favorite_category ?? 'No category picked yet'} />
          </Plate>

          <Plate>
            <h3 className="plate-subhead">Consistency</h3>
            <Stat label="Current day streak" value={profile.current_day_streak > 0 ? `🔥 ${profile.current_day_streak}` : '0'} />
            <Stat label="Longest day streak" value={profile.longest_day_streak} />
          </Plate>

          <Plate>
            <h3 className="plate-subhead">Duels &amp; Achievements</h3>
            <Stat label="Duel record" value={`${profile.duels_won}–${profile.duels_completed - profile.duels_won}`} />
            <Stat label="Achievements" value={`${profile.achievements_unlocked} / ${profile.achievements_total}`} />
          </Plate>
        </>
      )}
    </div>
  );
}
