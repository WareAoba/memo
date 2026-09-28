import { completeSchedule, reopenSchedule, type ScheduleDetail } from '../../api/schedules';

// A schedule checkbox completes all eligible tasks; status PATCH has a different contract.
export function toggleScheduleCompletion(schedule: Pick<ScheduleDetail, 'id' | 'status'>) {
  return schedule.status === 'completed'
    ? reopenSchedule(schedule.id)
    : completeSchedule(schedule.id);
}
