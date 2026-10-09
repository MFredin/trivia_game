import { request } from './request.js';

// Which holiday overlay is on today ('halloween'), or { overlay: null } between holidays. Public, so the sign-in screen can
// be dressed too.
export function getHolidayOverlay() {
  return request('/holiday');
}

// Only the switches that changed: { overlay?: boolean, motion?: boolean }.
export function saveHolidayPrefs(prefs, token) {
  return request('/account/holiday', { method: 'PATCH', body: JSON.stringify(prefs) }, token);
}

// The holiday's creature has been caught (a bat, a turkey, an owl). Answers { unlocked: true } the first time, which also sends the achievement
// toast over the socket, and { unlocked: false } after that; 404 when the holiday on has nothing to catch.
export function catchVisitor(token) {
  return request('/holiday/catch', { method: 'POST' }, token);
}
