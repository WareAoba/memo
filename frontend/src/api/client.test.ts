import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from './client';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(['caller', 'timeout'])('ends a stalled request on %s cancellation', async (source) => {
  const caller = new AbortController();
  const timeout = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
        }),
    ),
  );
  const request = requestJson('/api/entities', 'GET', undefined, caller.signal);
  const rejection = expect(request).rejects.toThrow('서버에 연결할 수 없습니다.');
  (source === 'caller' ? caller : timeout).abort();
  await rejection;
});
