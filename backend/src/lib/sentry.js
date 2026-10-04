import * as Sentry from '@sentry/node';

// Error tracking is entirely opt-in. With no SENTRY_DSN set — true for local dev, the test
// suite, and this sandbox — every export below is a no-op: no client is initialized, no
// network calls are made, and nothing is written to the console. Set SENTRY_DSN (see
// backend/.env.example) to turn it on; nothing else about the app's behavior changes either
// way, including the error responses routes already send to clients.
const dsn = process.env.SENTRY_DSN;
export const sentryEnabled = Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Railway's commit SHA doubles as a release identifier, matching how /api/health reports it.
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
  });
}

// Mounted first, before any route. Watches every response and reports the ones that come back
// with a 5xx status, even when a route's own try/catch already handled the error and answered
// the client itself (the common pattern in this codebase — see routes/sessions.js). This never
// changes req/res: it only observes res.on('finish') after the response is already on its way.
export function sentryRequestWatcher(req, res, next) {
  if (sentryEnabled) {
    res.on('finish', () => {
      if (res.statusCode >= 500) {
        Sentry.captureMessage(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, 'error');
      }
    });
  }
  next();
}

// Mounted last, after every route. Only installs Sentry's Express error-handling middleware
// when a DSN is configured, so with none set this is a no-op and Express's own default error
// handling (whatever would have run before Sentry existed) is completely unchanged. When an
// error does reach here, Sentry reports it and calls next(err) to continue on to Express's
// default handler exactly as before — this is purely additive reporting, never a replacement.
export function attachSentryErrorHandler(app) {
  if (!sentryEnabled) return;
  Sentry.setupExpressErrorHandler(app);
}
