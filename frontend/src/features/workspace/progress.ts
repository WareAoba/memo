import { tr } from '../../i18n';
import type { ScheduleDetail } from '../../api/schedules';
export const statusLabel = (status: string) =>
  ({
    planned: tr('progress.scheduled'),
    pending: tr('progress.pending'),
    in_progress: tr('progress.inProgress'),
    completed: tr('design-reference.completed'),
    skipped: tr('progress.skipped'),
    cancelled: tr('status.cancelled'),
  })[status] || status;
export function progressOf(schedules: ScheduleDetail[]) {
  const tasks = schedules.filter((s) => s.status !== 'cancelled').flatMap((s) => s.tasks);
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length,
  };
}
