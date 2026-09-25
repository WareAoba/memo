import { expect, it } from 'vitest';
import { dateKey, fromDateKey, makePreviewSchedules, monthDays } from './preview';

it('places leap-day and Sunday-start months into full calendar weeks', () => {
  const leap = monthDays(new Date(2024, 1, 1));
  expect(leap.filter(Boolean)).toHaveLength(29);
  expect(leap).toContain('2024-02-29');
  expect(leap[4]).toBe('2024-02-01');
  expect(leap.length % 7).toBe(0);
  const sunday = monthDays(new Date(2026, 1, 1));
  expect(sunday[0]).toBe('2026-02-01');
  expect(sunday).toHaveLength(28);
});
it('keeps repeated works independent across year boundaries', () => {
  const list = makePreviewSchedules('2026-12-31');
  const today = list.find((work) => work.id === 'english-today')!;
  const tomorrow = list.find((work) => work.id === 'english-tomorrow')!;
  expect(tomorrow.date).toBe('2027-01-01');
  expect(today.tasks[0]?.completed).toBe(true);
  expect(tomorrow.tasks[0]?.completed).toBe(false);
  expect(today.tasks).not.toBe(tomorrow.tasks);
});
it('uses local date parts rather than UTC when building date keys', () => {
  expect(dateKey(new Date(2026, 8, 24, 0, 1))).toBe('2026-09-24');
});

it.each(['0001-01-01', '0099-12-31', '0100-02-28', '2000-02-29', '9999-12-31'])(
  'preserves supported year in %s',
  (key) => {
    expect(dateKey(fromDateKey(key))).toBe(key);
    expect(monthDays(fromDateKey(key))).toContain(key);
  },
);
