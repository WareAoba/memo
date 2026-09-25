/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
const source =
  readFileSync(new NodeURL('../public/notification-locales.js', import.meta.url), 'utf8') +
  readFileSync(new NodeURL('../public/sw.js', import.meta.url), 'utf8');
function worker(preferences = new Map<string, string>()) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const client = {
    url: 'https://preset.test/',
    postMessage: vi.fn(),
    navigate: vi.fn(),
    focus: vi.fn(),
  };
  runInNewContext(source, {
    importScripts: () => undefined,
    URL,
    Date,
    Promise,
    indexedDB: {
      open: (name: string) => {
        if (name !== 'preset-preferences') throw new Error('History storage unavailable');
        const tx: { oncomplete?: () => void; objectStore: () => unknown } = {
          objectStore: () => ({
            put: (value: string, key: string) => {
              preferences.set(key, value);
              return { result: value };
            },
            get: (key: string) => ({ result: preferences.get(key) }),
          }),
        };
        const open = {
          onsuccess: undefined as (() => void) | undefined,
          result: {
            close: () => {},
            transaction: () => {
              void Promise.resolve().then(() => tx.oncomplete?.());
              return tx;
            },
          },
        };
        void Promise.resolve().then(() => open.onsuccess?.());
        return open;
      },
    },
    self: {
      location: { origin: 'https://preset.test' },
      addEventListener: (event: string, callback: (event: unknown) => void) => {
        handlers[event] = callback;
      },
      registration: { showNotification },
      clients: { matchAll: async () => [client], openWindow },
    },
  });
  async function push(data: unknown) {
    let pending: Promise<void> | undefined;
    handlers.push!({
      data: { json: () => data },
      waitUntil: (p: Promise<void>) => {
        pending = p;
      },
    });
    await pending;
  }
  async function click(url: string) {
    let pending: Promise<void> | undefined;
    handlers.notificationclick!({
      notification: { close: vi.fn(), data: { url } },
      waitUntil: (p: Promise<void>) => {
        pending = p;
      },
    });
    await pending;
  }
  async function setLanguage(language: string) {
    let pending: Promise<unknown> | undefined;
    handlers.message!({
      data: { type: 'set-language', language },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
  }
  return { push, click, setLanguage, showNotification, openWindow, client };
}
it.each([
  ['ko', '2026-09-25 · 09:00 시작 (Asia/Tokyo)'],
  ['en', '2026-09-25 · Starts at 09:00 (Asia/Tokyo)'],
  ['ja', '2026-09-25 · 09:00開始（Asia/Tokyo）'],
])('persists %s reminders across worker restarts', async (language, body) => {
  const preferences = new Map<string, string>();
  await worker(preferences).setLanguage(language);
  const restarted = worker(preferences);
  await restarted.push({
    type: 'reminder',
    notification_id: 'id:1',
    title: '내 이름',
    body: 'legacy',
    scheduled_date: '2026-09-25',
    start_time: '09:00',
    time_zone: 'Asia/Tokyo',
    start_at: Date.now() / 1000 + 600,
  });
  expect(restarted.showNotification).toHaveBeenCalledWith(
    '내 이름',
    expect.objectContaining({ body }),
  );
});
it('shows a system notification and informs open tabs even without local storage', async () => {
  const w = worker();
  await w.push({
    type: 'reminder',
    notification_id: 'id:1',
    title: 'Study',
    body: 'Soon',
    url: '/#/schedules/abcd',
    start_at: Date.now() / 1000 + 600,
  });
  expect(w.showNotification).toHaveBeenCalledWith(
    'Study',
    expect.objectContaining({ tag: 'id:1', renotify: false, body: 'Soon' }),
  );
  expect(w.client.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'push-delivered', notification_id: 'id:1' }),
  );
});
it('does not display expired or malformed payloads', async () => {
  const w = worker();
  await w.push({
    type: 'reminder',
    notification_id: 'id:1',
    title: 'Study',
    body: 'Soon',
    start_at: 1,
  });
  await w.push({ type: 'invalid' });
  expect(w.showNotification).not.toHaveBeenCalled();
});
it('notification click only navigates to a same-origin schedule', async () => {
  const w = worker();
  await w.click('https://evil.test/#/schedules/abcd');
  expect(w.client.navigate).not.toHaveBeenCalled();
  await w.click('/#/schedules/abcd');
  expect(w.client.navigate).toHaveBeenCalledWith('https://preset.test/#/schedules/abcd');
  expect(w.client.focus).toHaveBeenCalledOnce();
});
