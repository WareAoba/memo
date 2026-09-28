import { tr } from '../../i18n';
import type { ScheduleDetail } from '../../api/schedules';
import { dateInZone, timeInZone } from '../schedules/timeRange';

export function scheduleAppearance(item: ScheduleDetail, now: Date) {
  const date = dateInZone(item.time_zone, now);
  const time = timeInZone(item.time_zone, now);
  const instant = `${date}T${time}`;
  const completed = item.tasks.filter((task) => task.status === 'completed').length;
  const ratio = item.tasks.length
    ? completed / item.tasks.length
    : item.status === 'completed'
      ? 1
      : 0;
  const green = `hsl(140 var(--progress-saturation) ${86 - ratio * 30}%)`;
  if (item.status === 'cancelled')
    return {
      state: 'cancelled',
      label: tr('status.cancelled'),
      color: 'var(--status-cancelled)',
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
  if (!item.end_time) {
    const overdue = Boolean(
      item.start_time && instant >= `${item.scheduled_date}T${item.start_time}`,
    );
    return {
      state: overdue ? 'overdue' : 'upcoming',
      label: overdue ? tr('ScheduleBlock.incomplete') : tr('progress.scheduled'),
      color: overdue ? 'var(--status-overdue)' : 'var(--status-upcoming)',
      ratio,
      green,
    };
  }
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
  return {
    state: 'overdue',
    label: tr('scheduleAppearance.timeEndedIncomplete'),
    color: 'var(--status-overdue)',
    ratio,
    green,
  };
}
