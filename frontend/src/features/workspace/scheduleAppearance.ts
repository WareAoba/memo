import { tr } from '../../i18n';
import type { ScheduleDetail } from '../../api/schedules';
import { dateInZone } from '../schedules/timeRange';

export function scheduleAppearance(item: ScheduleDetail, now: Date) {
  const date = dateInZone(item.time_zone, now);
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: item.time_zone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });
  const instant = `${date}T${time}`;
  const completed = item.tasks.filter((task) => task.status === 'completed').length;
  const ratio = item.tasks.length
    ? completed / item.tasks.length
    : item.status === 'completed'
      ? 1
      : 0;
  const green = `color-mix(in srgb, hsl(140 32% ${86 - ratio * 30}%) var(--progress-mix, 100%), var(--surface))`;
  if (item.status === 'cancelled')
    return {
      state: 'cancelled',
      label: tr('status.cancelled'),
      color: 'var(--status-cancelled)',
      ratio,
      green,
    };
  if (instant < `${item.scheduled_date}T${item.start_time}`)
    return {
      state: 'upcoming',
      label: tr('progress.scheduled'),
      color: 'var(--status-upcoming)',
      ratio,
      green,
    };
  if (instant < `${item.end_date}T${item.end_time}`)
    return {
      state: 'current',
      label: tr('scheduleAppearance.inTimeSlot'),
      color: 'var(--status-current)',
      ratio,
      green,
    };
  if (item.status === 'completed' || ratio === 1)
    return {
      state: 'completed',
      label: tr('design-reference.completed'),
      color: green,
      ratio,
      green,
    };
  return {
    state: 'overdue',
    label: tr('scheduleAppearance.timeEndedIncomplete'),
    color: 'var(--status-overdue)',
    ratio,
    green,
  };
}
