import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import ModerationActionModal from './ModerationActionModal.jsx';
import ModerationLog from './ModerationLog.jsx';
import { MODERATION_ACTION_BY_ID } from '../constants/moderationActions.js';
import { REPORT_REASONS } from '../constants/reportReasons.js';
import { dismissReport, getReports, takeAction } from '../api/reports.js';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));
const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'log', label: 'Action log' },
];

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Standing({ report }) {
  const chips = [];
  if (report.standing.banned) chips.push('Banned');
  if (report.standing.suspended_until) chips.push(`Suspended until ${day(report.standing.suspended_until)}`);
  if (report.standing.must_rename) chips.push('Must choose a new name');
  const { actioned, other_open: otherOpen, suspensions } = report.history;
  if (actioned > 0) chips.push(`${actioned} earlier action${actioned === 1 ? '' : 's'} in 6 months`);
  if (suspensions > 0) chips.push(`${suspensions} suspension${suspensions === 1 ? '' : 's'}`);
  if (otherOpen > 0) chips.push(`${otherOpen} other open report${otherOpen === 1 ? '' : 's'}`);
  if (chips.length === 0) chips.push('No earlier record');
  return (
    <ul className="mod-chips" aria-label="This player's record">
      {chips.map((c) => (
        <li key={c} className="mod-chip">
          {c}
        </li>
      ))}
    </ul>
  );
}

function suggestionText(report) {
  const labels = report.suggestion.actions.map((a) =>
    a === 'suspend' ? `suspend ${report.suggestion.days} day${report.suggestion.days === 1 ? '' : 's'}` : MODERATION_ACTION_BY_ID[a].label.toLowerCase(),
  );
  return labels.join(' and ');
}

export default function AdminReportsScreen({ token }) {
  const [tab, setTab] = useState('open');
  const [reports, setReports] = useState(null);
  const [suspensionDays, setSuspensionDays] = useState([1, 7, 30]);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  // Bumped by the Refresh button: reports arrive while this screen is open, and nothing else
  // would fetch them.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (tab === 'log') return;
    setReports(null);
    setError(null);
    getReports(tab, token)
      .then((data) => {
        setReports(data.reports);
        setSuspensionDays(data.suspension_days);
      })
      .catch(() => setError('Could not load the reports.'));
  }, [tab, token, refreshKey]);

  const dismiss = async (id) => {
    setError(null);
    try {
      await dismissReport(id, token);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Could not dismiss that report.');
    }
  };

  const apply = async (fields) => {
    await takeAction(acting.id, fields, token);
    setReports((prev) => prev.filter((r) => r.id !== acting.id));
    setActing(null);
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Moderation</p>
          <h2 className="screen-title">Reports</h2>
        </div>
        <button type="button" className="secondary-button" onClick={() => setRefreshKey((k) => k + 1)}>
          Refresh
        </button>
      </div>
      <Plate>
        <div className="nav-links on-surface" style={{ marginBottom: '1rem' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`nav-btn ${tab === t.id ? 'is-active' : ''}`}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'log' ? (
          <ModerationLog token={token} refreshKey={refreshKey} />
        ) : (
          <>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {!reports && !error && <p className="explanation">Fetching&hellip;</p>}
            {reports && reports.length === 0 && (
              <p className="explanation">{tab === 'open' ? 'Nothing waiting for review.' : 'No resolved reports yet.'}</p>
            )}
            {reports && reports.length > 0 && (
              <ul className="friend-list">
                {reports.map((r) => (
                  <li key={r.id} className="report-row">
                    <div className="report-row-text">
                      <p className="report-row-title">
                        {r.reported_username} <span className="report-row-reason">· {REASON_LABEL[r.reason] ?? r.reason}</span>
                      </p>
                      <p className="explanation report-row-meta">
                        Reported by {r.reporter_username} on {day(r.created_at)}
                        {r.status !== 'open' && ` · ${r.resolution ?? (r.status === 'actioned' ? 'Action taken' : 'Dismissed')}`}
                      </p>
                      {r.details && <p className="report-row-details">&ldquo;{r.details}&rdquo;</p>}
                      {r.reason === 'offensive_bio' && r.reported_bio && (
                        <p className="report-row-bio">
                          <span className="report-row-bio-label">Their bio</span> {r.reported_bio}
                        </p>
                      )}
                      {r.status === 'open' && (
                        <>
                          <Standing report={r} />
                          {r.actionable && (
                            <p className="mod-suggestion">
                              Suggested: <b>{suggestionText(r)}</b>
                            </p>
                          )}
                          {!r.actionable && (
                            <p className="mod-suggestion">
                              {r.reported_username === 'Deleted player'
                                ? 'This account has been deleted, so there is nothing to do but dismiss the report.'
                                : 'Admins cannot be moderated from here.'}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {r.status === 'open' && (
                      <span className="friend-actions">
                        {r.actionable && (
                          <button type="button" className="primary-button" onClick={() => setActing(r)}>
                            Take action…
                          </button>
                        )}
                        <button type="button" className="secondary-button" onClick={() => dismiss(r.id)}>
                          Dismiss
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Plate>

      {acting && (
        <ModerationActionModal report={acting} suspensionDays={suspensionDays} onApply={apply} onClose={() => setActing(null)} />
      )}
    </div>
  );
}
