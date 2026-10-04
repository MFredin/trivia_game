import { rot13 } from './rot13.js';

// The one place a player can put their own words in front of other players, so it is the one
// place with a filter. This is a FIRST line, not a guarantee: a blocklist cannot recognise every
// way to be unpleasant, which is why every bio can also be reported and an admin can clear one
// (routes/reports.js). What it does is keep out the obvious — and, more usefully, the things
// that are harmful whatever the words: links, emails and phone numbers, which turn a profile
// into an advert or a way to pull someone off the platform.
export const BIO_MAX_LENGTH = 140;

// Obscured with rot13 so the repo does not hold a plain list of slurs. Extend without a deploy
// of code by setting BIO_BLOCKLIST_EXTRA to a comma-separated list on the service.
const BUILT_IN = [
  'shpx', 'shpxf', 'shpxrq', 'shpxre', 'shpxvat', 'fuvg', 'fuvgf', 'fuvggl', 'ovgpu', 'ovgpurf', 'phag', 'phagf',
  'nffubyr', 'nffubyrf', 'onfgneq', 'juber', 'fyhg', 'avttre', 'avttref', 'avttn', 'snttbg', 'snttbgf', 'snt',
  'ergneq', 'ergneqrq', 'xvxr', 'fcvp', 'puvax', 'genaal', 'xlf',
].map(rot13);

function blockedTerms() {
  const extra = (process.env.BIO_BLOCKLIST_EXTRA ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...BUILT_IN, ...extra]);
}

// Looks-like substitutions people use to get past a filter: 5h1t, f*ck, sh!t.
const LOOK_ALIKES = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '*': '' };

// "!" and "*" are two things in the wild — a stand-in for a letter (sh!t) and plain punctuation
// ("fuck!"). Both readings are checked, so neither a disguised word nor an excited one slips by.
function tokens(text, { punctuationIsLetter }) {
  const plain = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[01345 7@$!*]/g, (c) => {
      if (c === '!' || c === '*') return punctuationIsLetter ? LOOK_ALIKES[c === '*' ? '*' : '!'] : ' ';
      return c === ' ' ? ' ' : LOOK_ALIKES[c];
    });
  const words = plain.split(/[^a-z]+/).filter(Boolean);

  // "f u c k" and "f.u.c.k": a run of single letters is one word spelled out.
  const joined = [];
  let run = '';
  for (const w of words) {
    if (w.length === 1) {
      run += w;
      continue;
    }
    if (run.length > 1) joined.push(run);
    run = '';
    joined.push(w);
  }
  if (run.length > 1) joined.push(run);
  return joined;
}

const LINK = /(https?:|www\.|[a-z0-9-]+\.(com|net|org|io|gg|me|co|ly|app|xyz|tv|dev|info|link|page|site|online|store|shop|ru|cn|tk)\b|discord\.|t\.me)/i;
const EMAIL = /\S+@\S+/;

const BIO_ERRORS = {
  invalid: 'invalid_bio',
  too_long: 'bio_too_long',
  has_link: 'bio_has_link',
  not_allowed: 'bio_not_allowed',
};

/**
 * Checks a piece of text a player is about to put in front of other players — a bio, an Owl Post
 * message. `{ ok: true, value }` with the text as it should be stored (trimmed, whitespace
 * collapsed to single spaces, control characters removed), or `{ ok: false, reason }` where reason
 * is 'invalid', 'too_long', 'has_link' or 'not_allowed'. Empty is valid; whether empty is
 * acceptable is for the caller to say.
 */
export function checkText(input, max) {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid' };
  const value = input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if ([...value].length > max) return { ok: false, reason: 'too_long' };
  if (value === '') return { ok: true, value: '' };

  if (LINK.test(value) || EMAIL.test(value) || /@/.test(value)) return { ok: false, reason: 'has_link' };
  // A phone number however it is punctuated: seven or more digits once the separators go.
  // A range of years ("fan 1999-2024") is ordinary in a bio and is not one.
  const withoutYears = value.replace(/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/g, ' ');
  if (/\d(?:[\s().+-]*\d){6,}/.test(withoutYears)) return { ok: false, reason: 'has_link' };

  const blocked = blockedTerms();
  const readings = [tokens(value, { punctuationIsLetter: true }), tokens(value, { punctuationIsLetter: false })];
  if (readings.some((words) => words.some((t) => blocked.has(t)))) return { ok: false, reason: 'not_allowed' };

  return { ok: true, value };
}

/** A bio: the text rules above, at 140 characters, with errors named for the bio. */
export function checkBio(input) {
  const result = checkText(input, BIO_MAX_LENGTH);
  return result.ok ? result : { ok: false, error: BIO_ERRORS[result.reason] };
}
