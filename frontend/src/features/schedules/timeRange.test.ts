import { expect, it } from 'vitest';
import { dateInZone, timeInZone } from './timeRange';

it.each([
  ['Asia/Tokyo', '2026-09-27T14:59:59Z', '2026-09-27', '23:59'],
  ['Asia/Tokyo', '2026-09-27T15:00:00Z', '2026-09-28', '00:00'],
  ['America/New_York', '2026-03-08T06:59:59Z', '2026-03-08', '01:59'],
  ['America/New_York', '2026-03-08T07:00:00Z', '2026-03-08', '03:00'],
  ['America/New_York', '2026-11-01T05:59:59Z', '2026-11-01', '01:59'],
  ['America/New_York', '2026-11-01T06:00:00Z', '2026-11-01', '01:00'],
  ['Asia/Kathmandu', '2026-09-27T18:15:00Z', '2026-09-28', '00:00'],
  ['UTC', '2026-09-27T18:15:00Z', '2026-09-27', '18:15'],
])('formats %s at %s across midnight, DST and zone changes', (zone, instant, date, time) => {
  expect(dateInZone(zone, new Date(instant))).toBe(date);
  expect(timeInZone(zone, new Date(instant))).toBe(time);
});

it('rejects invalid time zones instead of falling back to the browser zone', () => {
  expect(() => dateInZone('Invalid/Zone')).toThrow(RangeError);
  expect(() => timeInZone('Invalid/Zone')).toThrow(RangeError);
});
