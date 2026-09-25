import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './health';

afterEach(() => vi.unstubAllGlobals());

describe('health API contract', () => {
  it('uses the same-origin API and validates success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"ok"}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    );
  });
  it('rejects HTTP failure without exposing the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private SQL error', { status: 503 })),
    );
    await expect(getHealth()).rejects.toMatchObject({
      status: 503,
      message: '서버 요청에 실패했습니다.',
    });
  });
  it.each(['<html>proxy</html>', '{"status":"broken"}', 'null'])(
    'rejects malformed response %s',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
      await expect(getHealth()).rejects.toThrow();
    },
  );
});
