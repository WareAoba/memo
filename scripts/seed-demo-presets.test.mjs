import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPresets, seedDemo } from './seed-demo-presets.mjs';
test('demo fixtures have stable unique names and cover large grouped lists', () => {
  const { works, tasks } = demoPresets();
  assert.equal(works.length, 30);
  assert.equal(tasks.length, 120);
  assert.equal(new Set(tasks.map((task) => task.group_name)).size, 8);
  for (const items of [works, tasks]) {
    assert.equal(new Set(items.map((item) => item.name)).size, items.length);
    assert.ok(items.every((item) => item.name.startsWith('테스트 · ') && item.tags.includes('demo-20260927')));
  }
  assert.deepEqual(demoPresets(), demoPresets());
});
test('seeding rejects non-local targets and missing track before writing', async () => {
  await assert.rejects(seedDemo('https://example.com', 'x'), /local development/);
  await assert.rejects(seedDemo('http://127.0.0.1:3000', ''), /explicit --track/);
});
