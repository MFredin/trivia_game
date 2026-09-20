// The one place a request is made. Timeouts, error shape and the auth header live here so
// every resource module below gets them for free and none of them can disagree about what a
// failure looks like.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// How long any single request may hang before we give up on it. Without this a request that
// never settles leaves the caller stuck forever with no way to tell that from a slow one.
const REQUEST_TIMEOUT_MS = 15000;

export async function request(path, options = {}, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers,
      // Guarded: AbortSignal.timeout is missing on older mobile Safari, where going without
      // a timeout is still better than throwing on every request.
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
        : {}),
      ...options,
    });
  } catch (cause) {
    // Never reached the server, or gave up waiting. Distinct from a server that answered
    // with an error — the two want different words and different retry behaviour.
    const error = new Error('network_unreachable');
    error.code = 'network_unreachable';
    error.transient = true;
    error.timedOut = cause?.name === 'TimeoutError';
    throw error;
  }

  if (res.status === 204) return null;

  // Read as text first: an error from a proxy or load balancer comes back as HTML, and
  // res.json() on that throws a parse error that hides the status code that explains it.
  const body = await res.text().catch(() => '');
  if (res.ok && body === '') return null;

  let data = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = null;
  }

  if (!res.ok || data === null) {
    const error = new Error(data?.error || `http_${res.status}`);
    error.code = data?.error ?? `http_${res.status}`;
    error.status = res.status;
    // 5xx and 429 are worth trying again; a 4xx means this request will never work as-is.
    error.transient = res.status >= 500 || res.status === 429;
    throw error;
  }
  return data;
}
