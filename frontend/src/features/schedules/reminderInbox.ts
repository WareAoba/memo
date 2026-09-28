import { tr } from '../../i18n';
import { isReminder, type Reminder } from '../../api/reminders';

export const reminderKey = (r: Reminder) => `${r.id}:${r.reminder_version ?? r.reminder_at}`;
export type InboxEntry = {
  reminder: Reminder;
  receivedAt: number;
  acknowledged: boolean;
  snoozeAt?: number;
  replayed?: boolean;
};
export type Inbox = { entries: InboxEntry[]; seen: Record<string, number> };
export const emptyInbox = (): Inbox => ({ entries: [], seen: {} });
export const inboxStorageKey = (accountId: string) => `preset.reminders.inbox.v1:${accountId}`;

export function readInbox(key: string, fallback: Inbox): Inbox {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {
      entries: fallback.entries,
      // Preserve pre-inbox delivery deduplication; this contains IDs, never titles.
      seen: {
        ...JSON.parse(localStorage.getItem('preset.reminders.seen.v2') ?? '{}'),
        ...fallback.seen,
      },
    };
    if (!value || !Array.isArray(value.entries) || !value.seen || typeof value.seen !== 'object')
      return fallback;
    return {
      entries: value.entries
        .filter(
          (entry: InboxEntry) =>
            entry &&
            isReminder(entry.reminder) &&
            Number.isFinite(entry.receivedAt) &&
            typeof entry.acknowledged === 'boolean' &&
            (entry.snoozeAt === undefined || Number.isFinite(entry.snoozeAt)) &&
            (entry.replayed === undefined || typeof entry.replayed === 'boolean'),
        )
        .slice(-200),
      seen: Object.fromEntries(
        Object.entries(value.seen).filter(
          (pair): pair is [string, number] =>
            typeof pair[1] === 'number' && Number.isFinite(pair[1]),
        ),
      ),
    };
  } catch {
    return fallback;
  }
}

export function reconcileInbox(
  inbox: Inbox,
  reminders: Reminder[],
  pushed: Record<string, number>,
  now: number,
) {
  const valid = new Map(reminders.map((r) => [reminderKey(r), r]));
  const seen = Object.fromEntries(
    Object.entries({ ...inbox.seen, ...pushed }).filter(([, expires]) => expires > now / 1000),
  );
  const show: string[] = [];
  const entries = inbox.entries
    .filter((e) => e.receivedAt > now - 30 * 86400000)
    .map((entry) => {
      const current = valid.get(reminderKey(entry.reminder));
      const next = { ...entry, reminder: current ?? entry.reminder };
      if (!current || entry.acknowledged) delete next.snoozeAt;
      else if (entry.snoozeAt !== undefined && entry.snoozeAt <= now) {
        show.push(reminderKey(current));
        delete next.snoozeAt;
        next.replayed = true;
      }
      return next;
    });
  for (const reminder of reminders) {
    const key = reminderKey(reminder);
    if (
      entries.some((e) => reminderKey(e.reminder) === key) ||
      reminder.reminder_at > now / 1000 ||
      reminder.start_at <= now / 1000
    )
      continue;
    entries.push({ reminder, receivedAt: now, acknowledged: false });
    if (!seen[key]) show.push(key);
    seen[key] = reminder.start_at;
  }
  return { inbox: { entries: entries.slice(-200), seen }, show, valid };
}

export const reminderHref = (r: Reminder) =>
  `#/schedules/${encodeURIComponent(r.id)}${r.track_id ? '?track=' + encodeURIComponent(r.track_id) : ''}`;
export const reminderDescription = (r: Reminder) =>
  tr('Reminders.valueStartsAtValueValue', {
    v1: r.scheduled_date,
    v2: r.start_time,
    v3: r.time_zone,
  });
