import { expect, it } from 'vitest';
import { emptyFields } from '../../api/works';
import type { ScheduleDetail } from '../../api/schedules';
import { todayDialLayout } from './todayDialLayout';

const today = '2026-09-28';
function work(id: string, start: string, end: string, endDate = today): ScheduleDetail {
  return {
    id,
    entity_id: '',
    title: id,
    scheduled_date: today,
    end_date: endDate,
    start_time: start,
    end_time: end,
    time_zone: 'Asia/Seoul',
    status: 'planned',
    notes: '',
    created_at: '',
    updated_at: '',
    entity_snapshot: emptyFields,
    tasks: [],
  };
}
it('keeps each overlapping arc at a fixed width and leaves independent schedules full width', () => {
  const items = [
    work('a', '09:00', '12:00'),
    work('b', '10:00', '11:00'),
    work('c', '10:30', '11:30'),
    work('d', '14:00', '15:00'),
  ];
  const result = todayDialLayout(items, today);
  expect(result[0]!.parts.map((p) => [p.start, p.end, p.count])).toEqual([[540, 720, 3]]);
  expect(result[3]!.parts).toEqual([{ start: 840, end: 900, lane: 0, count: 1 }]);
  for (const minute of [605, 635, 665]) {
    const active = result.flatMap((r) =>
      r.parts.filter((p) => p.start <= minute && p.end > minute),
    );
    expect(new Set(active.map((p) => p.lane)).size).toBe(active.length);
  }
  const reverse = todayDialLayout([...items].reverse(), today);
  for (const range of result)
    expect(reverse.find((r) => r.item.id === range.item.id)?.parts).toEqual(range.parts);
});
it('separates touching round caps while point markers keep their radial geometry', () => {
  const ranges = todayDialLayout(
    [work('a', '09:00', '10:00'), work('b', '10:00', '11:00'), work('point', '09:30', '')],
    today,
  );
  expect(ranges.slice(0, 2).every((r) => r.parts.length === 1 && r.parts[0]!.count === 2)).toBe(
    true,
  );
  expect(ranges[2]!.parts).toEqual([]);
});
it('renders a fixed two-hour continuation without changing next-day times, with no tail at 00:00', () => {
  const next = '2026-09-29';
  for (const [end, minutes] of [
    ['00:00', 0],
    ['00:15', 120],
    ['02:00', 120],
    ['08:00', 120],
  ] as const) {
    const ranges = todayDialLayout([work('a', '23:00', end, next)], today);
    expect(ranges.find((r) => r.tail)?.end ?? 0).toBe(minutes);
    const nextDay = todayDialLayout([work('a', '23:00', end, next)], next);
    expect(nextDay.every((r) => !r.tail)).toBe(true);
    if (end !== '00:00')
      expect(nextDay[0]!.end).toBe(Number(end.slice(0, 2)) * 60 + Number(end.slice(3)));
  }
});

it('reuses lanes across an overlap chain and keeps midnight continuation in the same lane', () => {
  const ranges = todayDialLayout(
    [
      work('a', '09:00', '11:00'),
      work('b', '10:00', '12:00'),
      work('c', '11:55', '13:00'),
      work('night', '23:00', '02:00', '2026-09-29'),
      work('morning', '01:00', '03:00'),
    ],
    today,
  );
  const part = (id: string) => ranges.find((r) => r.item.id === id)!.parts[0]!;
  expect(part('a').count).toBe(2);
  expect(part('a').lane).toBe(part('c').lane);
  expect(part('b').lane).not.toBe(part('c').lane);
  const night = ranges.filter((r) => r.item.id === 'night');
  expect(night).toHaveLength(2);
  expect(
    night.every(
      (r) =>
        r.parts.length === 1 && r.parts[0]!.count === 2 && r.parts[0]!.lane === part('night').lane,
    ),
  ).toBe(true);
});

it('reserves round-cap clearance across small gaps, including the midnight seam', () => {
  for (const items of [
    [work('a', '09:00', '10:00'), work('b', '10:05', '11:00')],
    [work('a', '23:00', '00:00', '2026-09-29'), work('b', '00:00', '01:00')],
    [work('a', '23:00', '23:59'), work('b', '00:01', '01:00')],
  ]) {
    const ranges = todayDialLayout(items, today);
    expect(ranges.map((r) => r.parts[0]!.count)).toEqual([2, 2]);
    expect(ranges[0]!.parts[0]!.lane).not.toBe(ranges[1]!.parts[0]!.lane);
    const reversed = todayDialLayout([...items].reverse(), today);
    for (const range of ranges)
      expect(reversed.find((r) => r.item.id === range.item.id)!.parts).toEqual(range.parts);
  }
});
it('leaves clearly separated caps at full width', () => {
  const ranges = todayDialLayout([work('a', '09:00', '10:00'), work('b', '11:00', '12:00')], today);
  expect(ranges.every((r) => r.parts[0]!.count === 1)).toBe(true);
});
