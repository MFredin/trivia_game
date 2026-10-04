// Why a player can be reported. A fixed list, so the admin queue is something to scan and the
// frontend's picker and the server's validation cannot disagree about what is allowed.
export const REPORT_REASONS = ['offensive_name', 'harassment', 'impersonation', 'cheating', 'other'];

export const REPORT_DETAILS_MAX = 500;

export const REPORT_OUTCOMES = ['dismissed', 'actioned'];
