import * as Sentry from '@sentry/react';

// Error tracking is entirely opt-in. With no VITE_SENTRY_DSN set at build time — true for
// local dev and this sandbox — this never initializes a client: no network calls, no console
// noise, no change to how the app renders or behaves. Set VITE_SENTRY_DSN (see
// frontend/.env.example) to turn it on.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Matches the build-time commit stamp the colophon already shows players (see
    // vite.config.js / __BUILD_COMMIT__), so a Sentry issue and a build are easy to line up.
    release: typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : undefined,
  });
}
