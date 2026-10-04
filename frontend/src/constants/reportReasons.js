// Why a player can be reported, in the order they are offered. The server keeps the ids alone
// (backend/src/lib/reportReasons.js) and refuses anything else; the wording lives here.
export const REPORT_REASONS = [
  { id: 'offensive_name', label: 'Offensive username or avatar' },
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'impersonation', label: 'Pretending to be someone else' },
  { id: 'cheating', label: 'Cheating' },
  { id: 'other', label: 'Something else' },
];

export const REPORT_DETAILS_MAX = 500;
