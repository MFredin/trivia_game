// How long records kept for safety are kept. Each period has a reason, and each is the privacy policy's
// to state (docs/legal/privacy-policy.md), so a change here is a change there.

// A copy of someone's messages attached to a report. Goes with the messages themselves (lib/owlPost.js
// RETENTION_DAYS) once the report is closed: it was kept to be judged, and has been.
export const REPORT_EVIDENCE_DAYS = 90;

// A closed report: the reason, the note, the outcome. A year is long enough to recognise a pattern and to
// answer an appeal, and covers the history a suggestion is worked out from (lib/moderation.js HISTORY_DAYS).
export const CLOSED_REPORT_DAYS = 365;

// What was done to a player (a warning, a suspension, a ban), counted from when it stopped mattering: when
// it was applied for something with no end, when a suspension or mute ended or was lifted, when a ban was
// lifted. A ban in force is kept for as long as it is.
export const MODERATION_ACTION_DAYS = 365;
