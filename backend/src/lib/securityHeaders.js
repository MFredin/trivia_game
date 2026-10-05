/**
 * Response headers for an API that only ever answers with JSON. Nothing here is ever a page, so the policy can be
 * the strictest one: no content may load from a response, and none may be framed. `nosniff` stops a browser
 * deciding a JSON body is something else; the referrer policy keeps full URLs (which can carry a username) from
 * leaving for other sites. The frontend's own headers are in frontend/public/serve.json.
 */
export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  next();
}
