import { request } from './request.js';

// Which commit the API is running. The colophon compares it against the frontend's own build
// stamp, so a half-finished deploy is visible rather than something to be inferred.
// Which commit the API is running. Used by the colophon to show when the two services are
// on different releases.
export function getHealth() {
  return request('/health');
}
