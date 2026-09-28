import { LocalizedError } from '../i18n/errors';
import { record, requestJson } from './client';

export type Reminder = {
  track_id?: string;
  reminder_version?: number;
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  time_zone: string;
  reminder_at: number;
  start_at: number;
};
export function isReminder(r: unknown): r is Reminder {
  return (
    record(r) &&
    ['id', 'title', 'scheduled_date', 'start_time', 'time_zone'].every(
      (k) => typeof r[k] === 'string',
    ) &&
    Number.isSafeInteger(r.reminder_at) &&
    Number.isSafeInteger(r.start_at) &&
    (r.track_id === undefined || typeof r.track_id === 'string') &&
    (r.reminder_version === undefined || Number.isSafeInteger(r.reminder_version))
  );
}
export async function getReminders(
  signal?: AbortSignal,
  include: string[] = [],
): Promise<Reminder[]> {
  const query = include.length
    ? '?' + new URLSearchParams({ include: [...new Set(include)].join(',') })
    : '';
  const raw = await requestJson('/api/reminders' + query, 'GET', undefined, signal);
  if (!Array.isArray(raw) || !raw.every(isReminder))
    throw new LocalizedError('reminders.couldNotLoadReminders');
  return raw as Reminder[];
}
