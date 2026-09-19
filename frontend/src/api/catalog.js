import { request } from './request.js';

// Reference data the app reads but never writes: the category list and the achievement
// catalog. Grouped because neither is big enough to be a module of its own, and both are
// deploy-time content rather than a feature.
export function getCategories() {
  return request('/categories');
}

export function getAchievements(token) {
  return request('/achievements', {}, token);
}
