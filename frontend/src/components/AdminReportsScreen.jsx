import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import { REPORT_REASONS } from '../constants/reportReasons.js';
import { getReports, resolveReport } from '../api/reports.js';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));
const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

export default function AdminReportsScreen({ token }) {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setReports(null);
    setError(null);
    getReports(status, token)
      .then((data) => setReports(data.reports))
      .catch(() => setError('Could not load the reports.'));
  }, [status, token]);

  const resolve = async (id, outcome, options) => {
    setError(null);
    try {
      await resolveReport(id, outcome, token, options);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Could not update that report.');
    }
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Moderation</p>
          <h2 className="screen-title">Reports</h2>
        </div>
      </div>
      <Plate>
        <div className="nav-links on-surface" style={{ marginBottom: '1rem' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-btn ${status === tab.id ? 'is-active' : ''}`}
              aria-pressed={status === tab.id}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {!reports && !error && <p className="explanation">Fetching&hellip;</p>}
        {reports && reports.length === 0 && (
          <p className="explanation">{status === 'open' ? 'Nothing waiting for review.' : 'No resolved reports yet.'}</p>
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
                    Reported by {r.reporter_username} on {new Date(r.created_at).toLocaleDateString()}
                    {r.status !== 'open' && ` · ${r.status === 'actioned' ? 'action taken' : 'dismissed'}`}
                  </p>
                  {r.details && <p className="report-row-details">&ldquo;{r.details}&rdquo;</p>}
                  {r.reason === 'offensive_bio' && r.reported_bio && (
                    <p className="report-row-bio">
                      <span className="report-row-bio-label">Their bio</span> {r.reported_bio}
                    </p>
                  )}
                </div>
                {r.status === 'open' && (
                  <span className="friend-actions">
                    {r.reason === 'offensive_bio' && r.reported_bio && (
                      <button type="button" className="primary-button" onClick={() => resolve(r.id, 'actioned', { clearBio: true })}>
                        Clear bio
                      </button>
                    )}
                    <button type="button" className={r.reason === 'offensive_bio' && r.reported_bio ? 'secondary-button' : 'primary-button'} onClick={() => resolve(r.id, 'actioned')}>
                      Action taken
                    </button>
                    <button type="button" className="secondary-button" onClick={() => resolve(r.id, 'dismissed')}>
                      Dismiss
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </div>
  );
}
