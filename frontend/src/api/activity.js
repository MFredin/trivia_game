// The activity feed (/api/activity): what friends, or everyone, have been doing — personal bests, achievements, duel wins.
import { request } from './request.js';

export function getActivity({ scope = 'friends', limit = 20 } = {}, token) {
  return request(`/activity?scope=${scope}&limit=${limit}`, {}, token);
}
