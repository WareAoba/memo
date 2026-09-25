import type { ScheduleDetail } from '../../api/schedules';
import { monthDays, fromDateKey } from './preview';

export function calendarWeeks(month: string, schedules: ScheduleDetail[]) {
  const cells = monthDays(fromDateKey(month + '-01'));
  return Array.from({ length: cells.length / 7 }, (_, week) => {
    const dates = cells.slice(week * 7, week * 7 + 7);
    const valid = dates.filter((date): date is string => date !== null);
    const occupied: boolean[][] = [];
    const bars = schedules
      .filter((s) => s.scheduled_date <= valid[valid.length - 1]! && s.end_date >= valid[0]!)
      .sort(
        (a, b) =>
          a.scheduled_date.localeCompare(b.scheduled_date) ||
          b.end_date.localeCompare(a.end_date) ||
          a.start_time.localeCompare(b.start_time) ||
          a.id.localeCompare(b.id),
      )
      .map((schedule) => {
        const start = dates.findIndex((date) => date !== null && date >= schedule.scheduled_date);
        const end =
          6 - [...dates].reverse().findIndex((date) => date !== null && date <= schedule.end_date);
        let lane = 0;
        while (occupied[lane]?.slice(start, end + 1).some(Boolean)) lane++;
        occupied[lane] ??= Array(7).fill(false);
        occupied[lane]!.fill(true, start, end + 1);
        return { schedule, start, end, lane };
      });
    return { dates, bars };
  });
}
