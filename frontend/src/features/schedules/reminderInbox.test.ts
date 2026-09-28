import { expect, it } from 'vitest';
import { emptyInbox, readInbox, reconcileInbox } from './reminderInbox';
const reminder = {
  id: 'one',
  title: 'One',
  scheduled_date: '2026-09-27',
  start_time: '09:00',
  time_zone: 'Asia/Tokyo',
  reminder_at: 1,
  start_at: 100,
  reminder_version: 1,
};

it('keeps dismissed history, consumes snoozes once after start, and preserves acknowledgement', () => {
  const first = reconcileInbox(emptyInbox(), [reminder], {}, 10000);
  expect(first.show).toEqual(['one:1']);
  first.inbox.entries[0]!.snoozeAt = 200000;
  expect(reconcileInbox(first.inbox, [reminder], {}, 199999).show).toEqual([]);
  const replay = reconcileInbox(first.inbox, [reminder], {}, 200000);
  expect(replay.show).toEqual(['one:1']);
  expect(reconcileInbox(replay.inbox, [reminder], {}, 215000).show).toEqual([]);
  replay.inbox.entries[0]!.acknowledged = true;
  expect(reconcileInbox(replay.inbox, [reminder], {}, 230000).show).toEqual([]);
});

it('cancels stale snoozes on removal or version change without erasing history', () => {
  for (const current of [[], [{ ...reminder, reminder_version: 2 }]]) {
    const first = reconcileInbox(emptyInbox(), [reminder], {}, 10000).inbox;
    first.entries[0]!.snoozeAt = 20000;
    const result = reconcileInbox(first, current, {}, 21000);
    expect(result.show).not.toContain('one:1');
    expect(result.inbox.entries[0]!.snoozeAt).toBeUndefined();
    expect(result.inbox.entries[0]!.reminder).toEqual(reminder);
  }
});

it('collects already pushed reminders without another toast and ignores not-yet-due validation results', () => {
  expect(reconcileInbox(emptyInbox(), [reminder], { 'one:1': 100 }, 10000).show).toEqual([]);
  expect(
    reconcileInbox(emptyInbox(), [{ ...reminder, reminder_at: 20 }], {}, 10000).inbox.entries,
  ).toEqual([]);
});

it('rejects malformed stored entries', () => {
  localStorage.setItem(
    'broken',
    JSON.stringify({ entries: [null, { reminder: {} }], seen: { bad: 'bad' } }),
  );
  expect(readInbox('broken', emptyInbox())).toEqual(emptyInbox());
});
