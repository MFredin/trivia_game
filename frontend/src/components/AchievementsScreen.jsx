import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { getAchievements } from '../api/catalog.js';

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function AchievementsScreen({ token }) {
  const [achievements, setAchievements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAchievements(token)
      .then((data) => setAchievements(data.achievements))
      .catch(() => setError('Could not load achievements.'));
  }, [token]);

  const unlockedCount = achievements?.filter((a) => a.unlocked).length ?? 0;

  const groups = [];
  if (achievements) {
    for (const a of achievements) {
      let group = groups.find((g) => g.category === a.category);
      if (!group) {
        group = { category: a.category, items: [] };
        groups.push(group);
      }
      group.items.push(a);
    }
  }

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Order of Merlin</p>
          <h2 className="screen-title">Achievements</h2>
        </div>
        {achievements && (
          <span className="explanation" style={{ margin: 0 }}>
            {unlockedCount} / {achievements.length} unlocked
          </span>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {groups.map((group) => (
        <Plate key={group.category} className="friend-section">
          <h3 className="plate-subhead">{group.category}</h3>
          <div className="achievement-grid">
            {group.items.map((a) => (
              <div key={a.id} className={`achievement-card ${a.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                <div className="achievement-card-head">
                  {!a.unlocked && <LockIcon />}
                  <span className="achievement-name">{a.name}</span>
                </div>
                <p className="achievement-desc">{a.description}</p>
                {a.unlocked && (
                  <p className="achievement-date">Unlocked {new Date(a.unlocked_at).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        </Plate>
      ))}
    </div>
  );
}
