import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../src/lib/achievements.js';
import { SYSTEM_TITLE_IDS, TITLES, TITLE_BY_ID, earnedTitleIds, titleView } from '../src/lib/titles.js';

test('the title catalogue is consistent', async (t) => {
  await t.test('ids and names are unique', () => {
    assert.equal(new Set(TITLES.map((x) => x.id)).size, TITLES.length);
    assert.equal(new Set(TITLES.map((x) => x.name.toLowerCase())).size, TITLES.length, 'two titles with one name would be indistinguishable');
  });

  await t.test('every earned title hangs on a real achievement, and no two share one', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const used = new Set();
    for (const title of TITLES.filter((x) => x.kind === 'earned')) {
      assert.ok(ids.has(title.requires), `${title.id} requires ${title.requires}, which is not an achievement`);
      assert.equal(used.has(title.requires), false, `${title.requires} already gives a title`);
      used.add(title.requires);
    }
  });

  await t.test('a system title needs no achievement, and an earned one needs no grant', () => {
    for (const title of TITLES) {
      if (title.kind === 'system') assert.equal(title.requires, undefined, title.id);
      else assert.equal(typeof title.requires, 'string', title.id);
      assert.ok(['earned', 'system'].includes(title.kind));
    }
    assert.ok(SYSTEM_TITLE_IDS.length >= 4);
  });
});

test('what a player holds and what travels beside their name', async (t) => {
  await t.test('earned titles follow the achievements unlocked, and only those', () => {
    assert.deepEqual(earnedTitleIds(new Set()), []);
    const held = earnedTitleIds(new Set(['milestone_1', 'streak_20', 'social_friend']));
    assert.deepEqual(held.sort(), ['newcomer', 'unshakeable']);
    assert.equal(held.includes('prefect'), false, 'a system title is never earned');
  });

  await t.test('the view is the id, the words and the kind, or nothing', () => {
    assert.deepEqual(titleView('prefect'), { id: 'prefect', name: 'Prefect', kind: 'system' });
    assert.equal(titleView(null), null);
    assert.equal(titleView('no-such-title'), null);
    assert.equal(TITLE_BY_ID.prefect.name, 'Prefect');
  });
});
