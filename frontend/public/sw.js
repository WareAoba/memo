/* Push-only service worker. API responses and application pages are not cached. */
importScripts('/notification-locales.js');
let languageWrite = Promise.resolve();
let selectedLanguage;
function languageStore(value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('preset-preferences', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('settings');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('settings', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('settings');
      const request = value ? store.put(value, 'language') : store.get('language');
      tx.oncomplete = () => {
        db.close();
        resolve(value || request.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
async function reminderBody(data) {
  if (![data.scheduled_date, data.start_time, data.time_zone].every((v) => typeof v === 'string'))
    return data.body; // Older server payloads remain readable.
  await languageWrite;
  const language = selectedLanguage || (await languageStore().catch(() => 'ko'));
  const template = self.reminderMessages[language] || self.reminderMessages.ko;
  const values = { v1: data.scheduled_date, v2: data.start_time, v3: data.time_zone };
  return template.replace(/\{\{(v[123])\}\}/g, (_, key) => values[key]);
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function historyStore(action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('preset-push', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('seen');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('seen', 'readwrite');
      const store = tx.objectStore('seen');
      const values = {};
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (entry) {
          if (entry.value <= Date.now() / 1000) entry.delete();
          else values[entry.key] = entry.value;
          entry.continue();
        } else if (action) action(store, values);
      };
      tx.oncomplete = () => {
        db.close();
        resolve(values);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

let processing = Promise.resolve();
self.addEventListener('push', (event) => {
  processing = processing
    .catch(() => {})
    .then(async () => {
      let data;
      try {
        data = event.data?.json();
      } catch {
        return;
      }
      if (
        !data ||
        data.type !== 'reminder' ||
        typeof data.notification_id !== 'string' ||
        typeof data.title !== 'string' ||
        typeof data.body !== 'string' ||
        !Number.isFinite(data.start_at)
      )
        return;
      if (data.start_at <= Date.now() / 1000) return;
      const seen = await historyStore().catch(() => ({}));
      if (!seen[data.notification_id]) {
        // A Web Push must produce a user-visible notification; foreground sends are suppressed at the server.
        await self.registration.showNotification(data.title, {
          body: await reminderBody(data),
          tag: data.notification_id,
          renotify: false,
          data: { url: data.url },
        });
        await historyStore((store) => store.put(data.start_at, data.notification_id)).catch(
          () => {},
        );
      }
      for (const client of await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })) {
        client.postMessage({
          type: 'push-delivered',
          notification_id: data.notification_id,
          start_at: data.start_at,
        });
      }
    });
  event.waitUntil(processing);
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'set-language' && ['ko', 'en', 'ja'].includes(event.data.language)) {
    selectedLanguage = event.data.language;
    const language = selectedLanguage;
    languageWrite = languageWrite.then(() => languageStore(language)).catch(() => undefined);
    event.waitUntil(languageWrite);
  }
  if (event.data?.type === 'get-push-history' && event.ports[0]) {
    event.waitUntil(
      historyStore()
        .then((seen) => event.ports[0].postMessage(seen))
        .catch(() => event.ports[0].postMessage({})),
    );
  }
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(event.notification.data?.url || '/', self.location.origin);
      if (url.origin !== self.location.origin || !/^#\/schedules\/[a-f0-9-]+$/i.test(url.hash))
        return;
      for (const client of await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })) {
        if (new URL(client.url).origin === url.origin) {
          await client.navigate(url.href);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
