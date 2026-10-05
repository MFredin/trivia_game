import { checkText } from './bioFilter.js';

// Owl Post is messages between friends: plain text, short, one to one. The limits below are the
// product's, and each has a reason — see docs/social-safety.md.
export const MESSAGE_MAX_LENGTH = 500;
export const SUBJECT_MAX_LENGTH = 60;
export const THREAD_PAGE_SIZE = 40;
export const INBOX_LIMIT = 100;

// Messages are deleted after this long, wherever they sit. A game's chat is not an archive, and
// the less of it there is, the less there is to protect, to disclose, or to get wrong.
export const RETENTION_DAYS = 90;

// How much of a conversation is copied into a report made from inside it.
export const EVIDENCE_MESSAGES = 20;

export const OWL_POST_MODES = ['friends', 'off'];

const ERRORS = {
  invalid: 'invalid_message',
  too_long: 'message_too_long',
  has_link: 'message_has_link',
  not_allowed: 'message_not_allowed',
};

/**
 * Checks a message with the same rules as a bio — no links, emails, handles or phone numbers, no
 * blocked words — at 500 characters, and not empty. `{ ok: true, value }` or `{ ok: false, error }`.
 */
export function checkMessage(input) {
  const result = checkText(input, MESSAGE_MAX_LENGTH);
  if (!result.ok) return { ok: false, error: ERRORS[result.reason] };
  if (result.value === '') return { ok: false, error: 'message_empty' };
  return result;
}

const SUBJECT_ERRORS = {
  invalid: 'invalid_subject',
  too_long: 'subject_too_long',
  has_link: 'subject_has_link',
  not_allowed: 'subject_not_allowed',
};

/**
 * A subject is optional: nothing, or only spaces, means none (`value: null`). When there is one it
 * gets the message's filter at 60 characters. `{ ok: true, value }` or `{ ok: false, error }`.
 */
export function checkSubject(input) {
  if (input === undefined || input === null) return { ok: true, value: null };
  const result = checkText(input, SUBJECT_MAX_LENGTH);
  if (!result.ok) return { ok: false, error: SUBJECT_ERRORS[result.reason] };
  return { ok: true, value: result.value === '' ? null : result.value };
}
