import { expect, it } from 'vitest';
import type { ScheduleDetail } from '../../api/schedules';
import { calendarWeeks } from './calendarLayout';
const schedule = (id: string, start: string, end: string) =>
  ({ id, scheduled_date: start, end_date: end, start_time: '09:00' }) as ScheduleDetail;
it('clips multi-day bars across weeks and month edges without colliding with other bars', () => {
  const weeks = calendarWeeks('2024-02', [
    schedule('long', '2024-01-31', '2024-02-06'),
    schedule('short', '2024-02-02', '2024-02-02'),
  ]);
  expect(weeks[0]!.bars.map(({ start, end, lane }) => ({ start, end, lane }))).toEqual([
    { start: 4, end: 6, lane: 0 },
    { start: 5, end: 5, lane: 1 },
  ]);
  expect(weeks[1]!.bars[0]).toMatchObject({ start: 0, end: 2, lane: 0 });
});
it('reuses lanes after an event ends and retains overflow events for daily counts', () => {
  const events = Array.from({ length: 6 }, (_, i) =>
    schedule(String(i), '2024-02-01', '2024-02-01'),
  );
  const bars = calendarWeeks('2024-02', [
    ...events,
    schedule('later', '2024-02-02', '2024-02-02'),
  ])[0]!.bars;
  expect(bars.map((bar) => bar.lane)).toEqual([0, 1, 2, 3, 4, 5, 0]);
});
