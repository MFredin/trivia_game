import { useEffect, useState } from 'react';
import { DUEL_REACTIONS } from '../constants/duelReactions.js';

// How long an incoming reaction stays on screen. Long enough to read mid-question, short
// enough that it is gone before it becomes clutter on the next one.
const REACTION_VISIBLE_MS = 4000;

export default function DuelOpponentStrip({ opponentUsername, live, incomingReaction, onReact }) {
  const [shown, setShown] = useState(null);
  const [sentAt, setSentAt] = useState(0);

  useEffect(() => {
    if (!incomingReaction) return undefined;
    setShown(incomingReaction);
    const timer = setTimeout(() => setShown(null), REACTION_VISIBLE_MS);
    return () => clearTimeout(timer);
    // Keyed on `at` as well as the reaction id so the same reaction sent twice in a row
    // re-triggers the timer rather than being treated as no change.
  }, [incomingReaction?.reaction, incomingReaction?.at]);

  // A local cooldown to match the server's throttle. Without it the buttons stay live while
  // the server has already started dropping frames, which reads as the feature being broken.
  const onCooldown = Date.now() - sentAt < 1500;

  const handleReact = (id) => {
    if (onCooldown) return;
    setSentAt(Date.now());
    onReact?.(id);
  };

  return (
    <div className="duel-strip">
      <div className="duel-strip-row">
        <span className="duel-strip-name">{opponentUsername}</span>
        <span className="duel-strip-stats">
          <span>score: {live?.runningTotal ?? 0}</span>
          <span>streak: {live?.streak ?? 0}</span>
          {live?.sessionComplete && <span className="duel-strip-done">Finished</span>}
        </span>
      </div>

      {onReact && (
        <div className="duel-reactions" role="group" aria-label="Send a reaction">
          {DUEL_REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="duel-reaction-btn"
              onClick={() => handleReact(r.id)}
              disabled={onCooldown}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {shown && (
        <p className="duel-reaction-incoming" role="status">
          <span className="duel-reaction-from">{shown.from}</span> {shown.label}
        </p>
      )}
    </div>
  );
}
