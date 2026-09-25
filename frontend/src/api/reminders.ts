import { LocalizedError } from '../i18n/errors';
import { record, requestJson } from './client';

export type Reminder = {
  reminder_version?: number;
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  time_zone: string;
  reminder_at: number;
  start_at: number;
};
export async function getReminders(signal?: AbortSignal): Promise<Reminder[]> {
  const raw = await requestJson('/api/reminders', 'GET', undefined, signal);
  if (
    !Array.isArray(raw) ||
    !raw.every(
      (r) =>
        record(r) &&
        ['id', 'title', 'scheduled_date', 'start_time', 'time_zone'].every(
          (k) => typeof r[k] === 'string',
        ) &&
        Number.isSafeInteger(r.reminder_at) &&
        Number.isSafeInteger(r.start_at),
    )
  )
    throw new LocalizedError('reminders.couldNotLoadReminders');
  return raw as Reminder[];
}
