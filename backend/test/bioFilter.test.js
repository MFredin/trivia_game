import test from 'node:test';
import assert from 'node:assert/strict';
import { BIO_MAX_LENGTH, checkBio } from '../src/lib/bioFilter.js';
import { rot13 } from '../src/lib/rot13.js';

const ok = (text) => assert.equal(checkBio(text).ok, true, `allows ${JSON.stringify(text)}`);
const refused = (text, error) => {
  const r = checkBio(text);
  assert.equal(r.ok, false, `refuses ${JSON.stringify(text)}`);
  assert.equal(r.error, error);
};

test('a bio', async (t) => {
  await t.test('keeps ordinary fan prose, including the things a naive filter trips on', () => {
    for (const text of [
      'Ravenclaw since 2001. Reading the books again this winter!',
      'Fan 1999-2024',
      'Scunthorpe class assassin',
      'I love Hufflepuff, cosy tea and a good duel.',
      'Pass the butter',
      '',
    ]) ok(text);
  });

  await t.test('is trimmed, with whitespace and control characters collapsed', () => {
    assert.equal(checkBio('  hello\n\n  there\t friend \u0000 ').value, 'hello there friend');
    assert.equal(checkBio('   ').value, '');
  });

  await t.test('has a length limit counted in characters, not bytes', () => {
    ok('a'.repeat(BIO_MAX_LENGTH));
    ok('✨'.repeat(BIO_MAX_LENGTH));
    refused('a'.repeat(BIO_MAX_LENGTH + 1), 'bio_too_long');
  });

  await t.test('refuses links, emails, handles and phone numbers however they are written', () => {
    for (const text of [
      'see https://example.org', 'www.example.net', 'visit example.com', 'find me at discord.gg/abc',
      'mail me a@b.co', 'dm @someone', 'call 555 123 4567', 'text +44 7700 900123', '(555)123-4567',
    ]) refused(text, 'bio_has_link');
  });

  await t.test('refuses blocked words through the usual disguises, but not words that merely contain one', () => {
    const word = rot13('shpx');
    for (const text of [word, word.toUpperCase(), `${word}!`, [...word].join(' '), [...word].join('.'), `what the ${word}`, 'sh1t', 'sh!t']) {
      refused(text, 'bio_not_allowed');
    }
    ok('assassin');
    ok('class');
    ok('Cockerel and a classic');
  });

  await t.test('takes extra blocked words from the environment', () => {
    process.env.BIO_BLOCKLIST_EXTRA = 'zzzblocked, other';
    refused('you are a zzzblocked one', 'bio_not_allowed');
    delete process.env.BIO_BLOCKLIST_EXTRA;
    ok('you are a zzzblocked one');
  });

  await t.test('is not a string at all', () => {
    for (const v of [null, undefined, 3, {}, []]) refused(v, 'invalid_bio');
  });
});
