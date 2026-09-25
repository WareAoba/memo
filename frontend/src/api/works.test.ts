import { afterEach, expect, it, vi } from 'vitest';
import { archiveWork, emptyFields, getWork, listWorks, saveWork } from './works';
const work = { ...emptyFields, id: 'id', name: '현장', created_at: 'now', updated_at: 'now' };
afterEach(() => vi.unstubAllGlobals());
it('sends only the requested mutation with same-origin credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(work)));
  vi.stubGlobal('fetch', fetcher);
  await saveWork({ archived: false }, 'id');
  expect(fetcher).toHaveBeenCalledWith(
    '/api/entities/id',
    expect.objectContaining({
      method: 'PATCH',
      credentials: 'same-origin',
      body: '{"archived":false}',
    }),
  );
});
it('encodes search and accepts a valid paginated response', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [work], total: 1, limit: 20, offset: 0 })),
    );
  vi.stubGlobal('fetch', fetcher);
  expect((await listWorks('a&b', false, 0)).items[0]?.name).toBe('현장');
  expect(fetcher.mock.calls[0]?.[0]).toContain('q=a%26b');
});
it('rejects malformed work responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...work, tags: [1] }))),
  );
  await expect(getWork('id')).rejects.toThrow('서버 응답');
});
it('does not show internal server errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('private SQL details', { status: 503 })),
  );
  await expect(getWork('id')).rejects.toThrow('서버 요청에 실패');
});
it('accepts an empty archive response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(archiveWork('id')).resolves.toBeUndefined();
});

it('explains network failures without losing user-facing context', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(getWork('id')).rejects.toThrow('서버에 연결할 수 없습니다.');
});
it('rejects invalid JSON with a useful response error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')));
  await expect(getWork('id')).rejects.toThrow('서버 응답을 확인할 수 없습니다.');
});
