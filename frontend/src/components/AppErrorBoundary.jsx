import { ErrorBoundary } from '@sentry/react';
import Plate from './Plate.jsx';

/**
 * Wraps the whole app. A render crash anywhere below this used to white-screen the player
 * with no trace of what happened; now it reports to Sentry (a no-op without VITE_SENTRY_DSN —
 * see lib/sentry.js) and shows a plate instead of a blank page, with a reload button as the
 * only way out, since we don't know enough about the crash to offer anything narrower.
 */
export default function AppErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="app-shell">
          <Plate className="error-boundary-plate">
            <h1 className="error-boundary-title">Something tore a page.</h1>
            <p className="error-boundary-message">
              This run hit a snag on our end, not yours — reloading should put things right.
            </p>
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </Plate>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
