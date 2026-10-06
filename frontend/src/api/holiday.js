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
