/**
 * The last two pieces of the request pipeline: what answers when nothing else did, and what answers when
 * something threw. Both speak JSON, because every caller is the app's own client or a script, and an HTML error
 * page (Express's default) is something neither can read.
 */

/** Mounted on /api after every route: an unknown API path is a JSON 404. */
export function notFound(req, res) {
  res.status(404).json({ error: 'not_found' });
}

/**
 * Express error handler. Anything a route throws, or an async route rejects with (lib/asyncErrors.js), arrives
 * here. A malformed or oversized body is the caller's mistake and is answered as one; everything else is a 500
 * whose cause is written to the log for the operator and never to the client (a message or stack can name tables
 * and queries).
 */
export function errorHandler(err, req, res, next) {
  // Too late to change the answer; let Express close the connection.
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });

  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  return res.status(500).json({ error: 'internal_error' });
}
