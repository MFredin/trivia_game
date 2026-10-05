import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_MAX_LENGTH, SUBJECT_MAX_LENGTH, checkMessage, checkSubject } from '../src/lib/owlPost.js';
import { rot13 } from '../src/lib/rot13.js';

const refused = (text, error) => {
  const r = checkMessage(text);
  assert.equal(r.ok, false, `refuses ${JSON.stringify(text)}`);
  assert.equal(r.error, error);
};

test('what an owl may say', async (t) => {
  await t.test('plain friendly text goes through, tidied', () => {
    assert.equal(checkMessage('  Good luck   in the duel!\n').value, 'Good luck in the duel!');
    assert.equal(checkMessage('Rematch? 🦉').ok, true);
    assert.equal(checkMessage('a'.repeat(MESSAGE_MAX_LENGTH)).ok, true);
  });

  await t.test('is never empty', () => {
    refused('', 'message_empty');
    refused('   \n\t ', 'message_empty');
  });

  await t.test('has a length limit in characters, not bytes', () => {
    refused('a'.repeat(MESSAGE_MAX_LENGTH + 1), 'message_too_long');
    assert.equal(checkMessage('✨'.repeat(MESSAGE_MAX_LENGTH)).ok, true);
  });

  await t.test('keeps links, emails, handles and phone numbers out, as bios do', () => {
    for (const text of ['see https://example.org', 'visit example.com', 'mail me at a@b.co', 'add me @someone', 'call 555 123 4567', 'discord.gg/abc']) {
      refused(text, 'message_has_link');
    }
  });

  await t.test('runs the same blocklist through the same disguises', () => {
    const word = rot13('shpx');
    for (const text of [word, `what the ${word}`, [...word].join(' '), 'sh1t']) refused(text, 'message_not_allowed');
    assert.equal(checkMessage('classic assassin').ok, true);
  });

  await t.test('is a string', () => {
    for (const v of [null, undefined, 3, {}, []]) refused(v, 'invalid_message');
  });
});

test('what an owl\u2019s subject may say', async (t) => {
  await t.test('is optional: nothing, or only spaces, is no subject', () => {
    for (const none of [undefined, null, '', '   ']) assert.deepEqual(checkSubject(none), { ok: true, value: null });
  });

  await t.test('is tidied and kept short', () => {
    assert.equal(checkSubject('  Duel   on Friday? ').value, 'Duel on Friday?');
    assert.equal(checkSubject('a'.repeat(SUBJECT_MAX_LENGTH)).ok, true);
    assert.equal(checkSubject('a'.repeat(SUBJECT_MAX_LENGTH + 1)).error, 'subject_too_long');
  });

  await t.test('must be text, and gets the same filter as the message', () => {
    assert.equal(checkSubject(7).error, 'invalid_subject');
    assert.equal(checkSubject('see example.com').error, 'subject_has_link');
    assert.equal(checkSubject(rot13('shpx')).error, 'subject_not_allowed');
  });
});
