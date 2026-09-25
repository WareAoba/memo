import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestJson } from './client';
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  requestJson: vi.fn(),
}));
const key = btoa(String.fromCharCode(...new Uint8Array(65).fill(1))).replace(/=/g, '');
const permission = vi.fn();
const subscribe = vi.fn();
const unsubscribe = vi.fn();
const current = vi.fn();
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: permission });
  const registration = { pushManager: { getSubscription: current, subscribe } };
  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
  });
  permission.mockResolvedValue('granted');
  current.mockResolvedValue(null);
  subscribe.mockResolvedValue({
    toJSON: () => ({
      endpoint: 'https://fcm.googleapis.com/send/test',
      keys: { p256dh: 'key', auth: 'auth' },
    }),
    unsubscribe,
  });
  vi.mocked(requestJson).mockImplementation(async (path) =>
    path.startsWith('/api/push/config')
      ? { enabled: true, subscribed: false, public_key: key }
      : { enabled: true },
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it('requests permission from the user action and saves the browser subscription', async () => {
  const push = await import('./push');
  await push.enablePush();
  expect(permission).toHaveBeenCalledTimes(1);
  expect(subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: expect.any(Uint8Array),
  });
  expect(requestJson).toHaveBeenCalledWith(
    '/api/push/subscriptions',
    'POST',
    expect.objectContaining({
      installation_id: expect.any(String),
      subscription: expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/send/test' }),
    }),
  );
});
it('does not subscribe when the permission is denied', async () => {
  permission.mockResolvedValue('denied');
  const push = await import('./push');
  await expect(push.enablePush()).rejects.toThrow('알림을 허용');
  expect(requestJson).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});
it('initialization does not request notification permission', async () => {
  const push = await import('./push');
  await push.initializePush();
  expect(permission).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});
it('disables server delivery before removing the browser subscription', async () => {
  current.mockResolvedValue({ unsubscribe });
  const push = await import('./push');
  await push.disablePush();
  expect(requestJson).toHaveBeenCalledWith(
    expect.stringMatching(/^\/api\/push\/subscriptions\//),
    'DELETE',
  );
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(vi.mocked(requestJson).mock.invocationCallOrder[0]).toBeLessThan(
    unsubscribe.mock.invocationCallOrder[0]!,
  );
});
