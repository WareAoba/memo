import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { initializePush, pushPresence, pushHistory } from '../../api/push';
import { getReminders } from '../../api/reminders';
import { Toast, ToastRegion } from '../shared/Toast';
import { NotificationMenu } from './NotificationMenu';
import { reminderDescription, reminderHref } from './reminderInbox';
import {
  emptyInbox,
  inboxStorageKey,
  readInbox,
  reconcileInbox,
  reminderKey,
  type Inbox,
} from './reminderInbox';

export function Reminders({
  accountId = 'local',
  children,
}: {
  accountId?: string;
  children?: (menu: ReactNode) => ReactNode;
}) {
  const storageKey = inboxStorageKey(accountId);
  useTranslation();
  const [inbox, setInbox] = useState<Inbox>(() => readInbox(storageKey, emptyInbox()));
  const current = useRef<Inbox>(inbox);
  const storageAvailable = useRef(true);
  const [visible, setVisible] = useState<string[]>([]);
  const change = useCallback(
    async (update: (value: Inbox) => Inbox) => {
      const apply = () => {
        const next = update(
          storageAvailable.current ? readInbox(storageKey, current.current) : current.current,
        );
        current.current = next;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // A quota failure can leave readable but stale persisted data.
          storageAvailable.current = false;
        }
        setInbox(next);
      };
      if (navigator.locks) await navigator.locks.request(storageKey, apply);
      else apply();
    },
    [storageKey],
  );

  useEffect(() => {
    const isHidden = () => document.visibilityState === 'hidden';
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function poll() {
      if (!active || pending || isHidden() || !navigator.onLine) return;
      pending = true;
      try {
        await initializePush().catch(() => undefined);
        await pushPresence().catch(() => undefined);
        const pushed = await pushHistory();
        const stored = storageAvailable.current
          ? readInbox(storageKey, current.current)
          : current.current;
        const include = stored.entries.filter((e) => !e.acknowledged).map((e) => e.reminder.id);
        const reminders = await getReminders(controller.signal, include);
        if (!active || isHidden()) return;
        await change((value) => {
          if (!active) return value;
          const result = reconcileInbox(value, reminders, pushed, Date.now());
          setVisible((previous) =>
            [...new Set([...previous, ...result.show])].filter((key) => {
              const entry = result.inbox.entries.find((e) => reminderKey(e.reminder) === key);
              return (
                entry &&
                !entry.acknowledged &&
                entry.snoozeAt === undefined &&
                result.valid.has(key) &&
                (entry.replayed || entry.reminder.start_at > Date.now() / 1000)
              );
            }),
          );
          return result.inbox;
        });
        await pushPresence(
          reminders
            .filter((r) => current.current.seen[reminderKey(r)] && r.reminder_version !== undefined)
            .map((r) => ({ schedule_id: r.id, reminder_version: r.reminder_version! })),
        ).catch(() => undefined);
      } catch {
        /* Keep history and snoozes on failure; validate on the next successful poll. */
      } finally {
        pending = false;
      }
    }
    const refresh = () => {
      void poll();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden')
        void pushPresence([], false).catch(() => undefined);
      else refresh();
    };
    const storage = (event: StorageEvent) => {
      if (storageAvailable.current && event.key === storageKey) {
        const next = readInbox(storageKey, current.current);
        current.current = next;
        setInbox(next);
        setVisible((previous) =>
          previous.filter((key) =>
            next.entries.some(
              (e) => reminderKey(e.reminder) === key && !e.acknowledged && e.snoozeAt === undefined,
            ),
          ),
        );
      }
    };
    const pushed = (event: MessageEvent) => {
      const value = event.data;
      if (
        value?.type !== 'push-delivered' ||
        typeof value.notification_id !== 'string' ||
        !Number.isFinite(value.start_at)
      )
        return;
      void change((previous) => ({
        ...previous,
        seen: { ...previous.seen, [value.notification_id]: value.start_at },
      })).then(refresh);
      setVisible((previous) => previous.filter((key) => key !== value.notification_id));
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    navigator.serviceWorker?.addEventListener('message', pushed);
    window.addEventListener('storage', storage);
    window.addEventListener('push-state-changed', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('schedules-changed', refresh);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      navigator.serviceWorker?.removeEventListener('message', pushed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('push-state-changed', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('schedules-changed', refresh);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [change, storageKey]);

  const hide = (key: string) => setVisible((previous) => previous.filter((k) => k !== key));
  const menu = (
    <NotificationMenu
      entries={inbox.entries}
      onAcknowledge={(keys) => {
        setVisible((previous) => previous.filter((key) => !keys.includes(key)));
        void change((value) => ({
          ...value,
          entries: value.entries.map((e) =>
            keys.includes(reminderKey(e.reminder))
              ? { ...e, acknowledged: true, snoozeAt: undefined }
              : e,
          ),
        }));
      }}
    />
  );
  return (
    <>
      {children ? children(menu) : menu}
      <ToastRegion>
        {inbox.entries
          .filter((e) => visible.includes(reminderKey(e.reminder)))
          .map((entry) => {
            const r = entry.reminder;
            const key = reminderKey(r);
            return (
              <Toast
                key={key}
                title={r.title}
                href={reminderHref(r)}
                onClose={() => hide(key)}
                onSnooze={(minutes) => {
                  hide(key);
                  void change((value) => ({
                    ...value,
                    entries: value.entries.map((e) =>
                      reminderKey(e.reminder) === key && !e.acknowledged
                        ? { ...e, snoozeAt: Date.now() + minutes * 60000, replayed: false }
                        : e,
                    ),
                  }));
                }}
              >
                {reminderDescription(r)}
              </Toast>
            );
          })}
      </ToastRegion>
    </>
  );
}
