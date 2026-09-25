import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { initializePush, pushPresence, pushHistory } from '../../api/push';
import { useEffect, useState } from 'react';
import { getReminders, type Reminder } from '../../api/reminders';
import { Toast, ToastRegion } from '../shared/Toast';

const storageKey = 'preset.reminders.seen.v2';
const keyOf = (r: Reminder) => `${r.id}:${r.reminder_version ?? r.reminder_at}`;

export function Reminders() {
  useTranslation();
  const [items, setItems] = useState<Reminder[]>([]);
  useEffect(() => {
    let active = true;
    let pending = false;
    let seen: Record<string, number> = {};
    const controller = new AbortController();
    function readSeen() {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          for (const [key, expires] of Object.entries(stored)) {
            if (typeof expires === 'number' && Number.isFinite(expires)) seen[key] = expires;
          }
        }
      } catch {
        /* Storage is optional; keep in-memory deduplication. */
      }
      seen = Object.fromEntries(
        Object.entries(seen).filter(([, expires]) => expires > Date.now() / 1000),
      );
    }
    async function poll() {
      if (!active || pending || document.visibilityState === 'hidden' || !navigator.onLine) return;
      pending = true;
      try {
        await initializePush().catch(() => undefined);
        await pushPresence().catch(() => undefined);
        Object.assign(seen, await pushHistory());
        const reminders = await getReminders(controller.signal);
        const present = () => {
          if (!active || document.visibilityState === 'hidden') return;
          readSeen();
          const fresh = reminders.filter((r) => !seen[keyOf(r)]);
          fresh.forEach((r) => {
            seen[keyOf(r)] = r.start_at;
          });
          try {
            localStorage.setItem(storageKey, JSON.stringify(seen));
          } catch {
            /* Memory fallback. */
          }
          const valid = new Map(reminders.map((r) => [keyOf(r), r]));
          setItems((previous) => [...previous.flatMap((r) => valid.get(keyOf(r)) ?? []), ...fresh]);
        };
        if (navigator.locks) await navigator.locks.request(storageKey, present);
        else present();
        await pushPresence(
          reminders
            .filter((r) => seen[keyOf(r)] && r.reminder_version !== undefined)
            .map((r) => ({ schedule_id: r.id, reminder_version: r.reminder_version! })),
        ).catch(() => undefined);
      } catch {
        /* Retry after reconnect or on the next tick. */
      } finally {
        pending = false;
      }
    }
    const refresh = () => {
      void poll();
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    const visibility = () => {
      if (document.visibilityState === 'hidden')
        void pushPresence([], false).catch(() => undefined);
      else refresh();
    };
    const pushed = (event: MessageEvent) => {
      const value = event.data;
      if (
        value?.type !== 'push-delivered' ||
        typeof value.notification_id !== 'string' ||
        !Number.isFinite(value.start_at)
      )
        return;
      readSeen();
      seen[value.notification_id] = value.start_at;
      try {
        localStorage.setItem(storageKey, JSON.stringify(seen));
      } catch {
        /* Memory fallback. */
      }
      setItems((previous) => previous.filter((r) => keyOf(r) !== value.notification_id));
      refresh();
    };
    navigator.serviceWorker?.addEventListener('message', pushed);
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
      window.removeEventListener('push-state-changed', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('schedules-changed', refresh);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <ToastRegion>
      {items.map((r) => (
        <Toast
          key={keyOf(r)}
          title={r.title}
          href={`#/schedules/${r.id}`}
          onClose={() =>
            setItems((previous) => previous.filter((item) => keyOf(item) !== keyOf(r)))
          }
        >
          {tr('Reminders.valueStartsAtValueValue', {
            v1: r.scheduled_date,
            v2: r.start_time,
            v3: r.time_zone,
          })}
        </Toast>
      ))}
    </ToastRegion>
  );
}
