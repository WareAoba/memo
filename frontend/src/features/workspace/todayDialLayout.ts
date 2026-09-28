import type { ScheduleDetail } from '../../api/schedules';
import { nextDate, toMinutes } from '../schedules/timeRange';

export type DialPart = { start: number; end: number; lane: number; count: number };
export type DialRange = {
  item: ScheduleDetail;
  start: number;
  end: number;
  tail: boolean;
  parts: DialPart[];
};

export const dialBorderWidth = 0.8;
export const dialTailRenderEnd = 120;
export const dialTailFadeEnd = 90;
export function dialStrokeGeometry(part: DialPart) {
  const slot = 28 / part.count;
  return {
    radius: 124 + slot * (part.lane + 0.5),
    width: slot - (part.count > 1 ? Math.min(2, slot / 4) : 0),
  };
}

// Reserve the widest round cap plus its transparent outline. Checking shifted
// copies also separates 23:xx endings from 00:xx starts on the circular dial.
const capMinutes = (Math.asin((14 + dialBorderWidth) / 138) * 1440) / (2 * Math.PI);
function visuallyOverlaps(left: DialRange, right: DialRange) {
  return [-1440, 0, 1440].some(
    (shift) =>
      left.start - capMinutes <= right.end + shift + capMinutes &&
      right.start + shift - capMinutes <= left.end + capMinutes,
  );
}

// Allocate a fixed lane to each schedule, including its midnight continuation.
export function todayDialLayout(items: ScheduleDetail[], today: string): DialRange[] {
  const ranges: DialRange[] = [];
  for (const item of items) {
    if (
      item.status === 'cancelled' ||
      !item.start_time ||
      item.scheduled_date > today ||
      item.end_date < today
    )
      continue;
    if (!item.end_time && item.scheduled_date !== today) continue;
    const start = item.scheduled_date < today ? 0 : toMinutes(item.start_time);
    const end = !item.end_time ? start : item.end_date > today ? 1440 : toMinutes(item.end_time);
    if (item.end_time && end <= start) continue;
    ranges.push({ item, start, end, tail: false, parts: [] });
    if (item.end_time && item.end_date > today) {
      // A fixed visual continuation; saved times and next-day ranges stay exact.
      if (item.end_date !== nextDate(today) || toMinutes(item.end_time) > 0)
        ranges.push({ item, start: 0, end: dialTailRenderEnd, tail: true, parts: [] });
    }
  }
  const arcs = ranges.filter((range) => Boolean(range.item.end_time));
  const schedules = [...new Set(arcs.map((range) => range.item.id))]
    .map((id) => ({
      id,
      ranges: arcs.filter((range) => range.item.id === id),
    }))
    .sort((a, b) => a.ranges[0]!.start - b.ranges[0]!.start || a.id.localeCompare(b.id));
  const neighbors = schedules.map((a) =>
    schedules.flatMap((b, index) =>
      a.id !== b.id &&
      a.ranges.some((left) => b.ranges.some((right) => visuallyOverlaps(left, right)))
        ? [index]
        : [],
    ),
  );
  const visited = new Set<number>();
  schedules.forEach((_, index) => {
    if (visited.has(index)) return;
    const group: number[] = [];
    const pending = [index];
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      group.push(current);
      pending.push(...neighbors[current]!);
    }
    // Stable start order reuses vacated lanes without changing an arc mid-way.
    group.sort((a, b) => a - b);
    const lanes = new Map<number, number>();
    for (const current of group) {
      const occupied = new Set(neighbors[current]!.map((neighbor) => lanes.get(neighbor)));
      let lane = 0;
      while (occupied.has(lane)) lane++;
      lanes.set(current, lane);
    }
    const count = Math.max(...lanes.values()) + 1;
    for (const current of group) {
      for (const range of schedules[current]!.ranges) {
        range.parts.push({ start: range.start, end: range.end, lane: lanes.get(current)!, count });
      }
    }
  });
  return ranges;
}
