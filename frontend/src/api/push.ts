import { LocalizedError } from '../i18n/errors';
import { tr, currentLanguage } from '../i18n';
import { record, requestJson } from './client';

export type PushState = {
  supported: boolean;
  enabled: boolean;
  subscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  publicKey: string | null;
};
export type PushReceipt = { schedule_id: string; reminder_version: number };
let installation: string | undefined;
let active = false;
let tabId: string | undefined;
let initialization: Promise<PushState> | undefined;
export function installationId() {
  if (installation) return installation;
  try {
    installation = localStorage.getItem('preset.push.installation') ?? undefined;
  } catch {
    /* Memory fallback. */
  }
  installation ??= crypto.randomUUID();
  try {
    localStorage.setItem('preset.push.installation', installation);
  } catch {
    /* Memory fallback. */
  }
  return installation;
}
export function pushSupported() {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
async function config() {
  const v = await requestJson(
    '/api/push/config?installation_id=' + encodeURIComponent(installationId()),
  );
  if (
    !record(v) ||
    typeof v.enabled !== 'boolean' ||
    typeof v.subscribed !== 'boolean' ||
    !(v.public_key === null || typeof v.public_key === 'string')
  )
    throw new LocalizedError('push.couldNotLoadPushNotificationSettings');
  return { enabled: v.enabled, subscribed: v.subscribed, publicKey: v.public_key as string | null };
}
async function worker() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const ready = await navigator.serviceWorker.ready;
  ready.active?.postMessage({ type: 'set-language', language: currentLanguage() });
  return registration;
}
export async function readPushState(): Promise<PushState> {
  if (!pushSupported())
    return {
      supported: false,
      enabled: false,
      subscribed: false,
      permission: 'unsupported',
      publicKey: null,
    };
  const settings = await config();
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  const browserKey = subscription?.options?.applicationServerKey;
  const expectedKey = settings.publicKey
    ? Uint8Array.from(atob(settings.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      )
    : undefined;
  const keyMatches =
    !browserKey ||
    (expectedKey &&
      browserKey.byteLength === expectedKey.length &&
      new Uint8Array(browserKey).every((v, i) => v === expectedKey[i]));
  active =
    Boolean(keyMatches) &&
    settings.enabled &&
    settings.subscribed &&
    Boolean(subscription) &&
    Notification.permission === 'granted';
  return { ...settings, subscribed: active, supported: true, permission: Notification.permission };
}
export function initializePush() {
  initialization ??= readPushState()
    .then(async (state) => {
      if (state.subscribed) {
        await worker();
        await pushPresence([], document.visibilityState === 'visible');
      }
      return state;
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
export async function enablePush() {
  if (!pushSupported())
    throw new LocalizedError('push.pushNotificationsAreNotSupportedInThisBrowser');
  // Permission is requested directly from the user's click, before network awaits.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new LocalizedError('push.allowNotificationsInYourBrowserSSiteSettings');
  const settings = await config();
  if (!settings.enabled || !settings.publicKey)
    throw new LocalizedError('push.pushNotificationsAreDisabledOnTheServer');
  const registration = await worker();
  const key = Uint8Array.from(atob(settings.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  let subscription = await registration.pushManager.getSubscription();
  const oldKey = subscription?.options.applicationServerKey;
  if (
    subscription &&
    (!settings.subscribed ||
      (oldKey &&
        (oldKey.byteLength !== key.length ||
          !new Uint8Array(oldKey).every((v, i) => v === key[i]))))
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  try {
    await requestJson('/api/push/subscriptions', 'POST', {
      installation_id: installationId(),
      subscription: subscription.toJSON(),
    });
  } catch (error) {
    const provider = new URL(subscription.endpoint).hostname;
    if (provider === 'jmt17.google.com')
      throw new Error(tr('push.thisBrowserSTestPushServiceIsNotSupported'), { cause: error });
    throw new Error(
      tr('push.couldNotRegisterPushNotificationsValue', {
        v1: error instanceof Error ? error.message : '',
      }),
      {
        cause: error,
      },
    );
  }
  active = true;
  initialization = undefined;
  window.dispatchEvent(new Event('push-state-changed'));
  return readPushState();
}
export async function disablePush() {
  await requestJson('/api/push/subscriptions/' + encodeURIComponent(installationId()), 'DELETE');
  active = false;
  initialization = undefined;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  window.dispatchEvent(new Event('push-state-changed'));
  return readPushState();
}
export async function pushPresence(
  seen: PushReceipt[] = [],
  visible = document.visibilityState === 'visible',
) {
  if (!active) return;
  const batches = seen.length
    ? Array.from({ length: Math.ceil(seen.length / 100) }, (_, i) =>
        seen.slice(i * 100, i * 100 + 100),
      )
    : [[]];
  for (const batch of batches)
    await requestJson('/api/push/presence', 'POST', {
      installation_id: installationId(),
      tab_id: (tabId ??= crypto.randomUUID()),
      visible,
      seen: batch,
    });
}
export async function pushHistory(): Promise<Record<string, number>> {
  if (!active) return {};
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) return {};
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: Record<string, number>) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish({}), 2000);
    channel.port1.onmessage = (event) => {
      const value: unknown = event.data;
      finish(
        record(value)
          ? (Object.fromEntries(
              Object.entries(value).filter(
                ([, expiry]) => typeof expiry === 'number' && Number.isFinite(expiry),
              ),
            ) as Record<string, number>)
          : {},
      );
    };
    registration.active?.postMessage({ type: 'get-push-history' }, [channel.port2]);
  });
}
