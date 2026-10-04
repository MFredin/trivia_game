import { useEffect, useState } from 'react';
import { MODERATION_ACTION_BY_ID } from '../constants/moderationActions.js';
import { getActionLog, liftAction } from '../api/moderation.js';

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function actionLabel(a) {
  const base = MODERATION_ACTION_BY_ID[a.action]?.label ?? a.action;
  return a.action === 'suspend' ? `${base} ${a.days} day${a.days === 1 ? '' : 's'}` : base;
}

function status(a) {
  if (a.action !== 'suspend' && a.action !== 'ban') return null;
  if (a.lifted_at) return 'Lifted';
  if (a.active) return 'In force';
  return 'Ended';
}

/** Everything done to players, newest first — with a way to lift a suspension or ban still in force. */
export default function ModerationLog({ token, refreshKey }) {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    getActionLog(token)
      .then((data) => setActions(data.actions))
      .catch(() => setError('Could not load the log.'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshKey]);

  const lift = async (id) => {
    setError(null);
    try {
      await liftAction(id, token);
      await load();
    } catch {
      setError('Could not lift that.');
    }
  };

  return (
    <>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {!actions && !error && <p className="explanation">Fetching&hellip;</p>}
      {actions && actions.length === 0 && <p className="explanation">Nothing has been done to anyone yet.</p>}
      {actions && actions.length > 0 && (
        <ul className="friend-list">
          {actions.map((a) => {
            const state = status(a);
            return (
              <li key={a.id} className="report-row">
                <div className="report-row-text">
                  <p className="report-row-title">
                    {a.username} <span className="report-row-reason">· {actionLabel(a)}</span>
                    {state && <span className={`mod-state ${a.active ? 'is-active' : ''}`}>{state}</span>}
                  </p>
                  <p className="explanation report-row-meta">
                    By {a.admin_username} on {when(a.created_at)}
                  </p>
                  <p className="report-row-details">&ldquo;{a.note}&rdquo;</p>
                </div>
                {a.active && (
                  <button type="button" className="secondary-button" onClick={() => lift(a.id)}>
                    Lift
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
