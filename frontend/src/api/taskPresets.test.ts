import { afterEach, expect, it, vi } from 'vitest';
import {
  archiveTaskPreset,
  emptyFields,
  getTaskPreset,
  listTaskPresets,
  saveTaskPreset,
} from './taskPresets';
const preset = {
  ...emptyFields,
  id: 'id',
  name: '현장',
  version: 1,
  created_at: 'now',
  updated_at: 'now',
};
afterEach(() => vi.unstubAllGlobals());
it('sends only the requested mutation with same-origin credentials', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(preset)));
  vi.stubGlobal('fetch', fetcher);
  await saveTaskPreset({ archived: false }, 'id');
  expect(fetcher).toHaveBeenCalledWith(
    '/api/task-presets/id',
    expect.objectContaining({
      method: 'PATCH',
      credentials: 'same-origin',
      body: '{"archived":false}',
    }),
  );
});
it('encodes search and accepts a valid paginated response', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [{ ...preset, items: undefined, item_count: 0 }],
        total: 1,
        limit: 20,
        offset: 0,
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  expect((await listTaskPresets('a&b', false, 0)).items[0]?.name).toBe('현장');
  expect(fetcher.mock.calls[0]?.[0]).toContain('q=a%26b');
});
it('rejects malformed preset responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...preset, tags: [1] }))),
  );
  await expect(getTaskPreset('id')).rejects.toThrow('서버 응답');
});
it('does not show internal server errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('private SQL details', { status: 503 })),
  );
  await expect(getTaskPreset('id')).rejects.toThrow('서버 요청에 실패');
});
it('accepts an empty archive response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(archiveTaskPreset('id')).resolves.toBeUndefined();
});

it('explains network failures without losing user-facing context', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(getTaskPreset('id')).rejects.toThrow('서버에 연결할 수 없습니다.');
});
it('rejects invalid JSON with a useful response error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json')));
  await expect(getTaskPreset('id')).rejects.toThrow('서버 응답을 확인할 수 없습니다.');
});

it('validates checklist types, positions and version in responses', async () => {
  for (const extra of [
    { version: 0 },
    {
      items: [
        {
          id: 'item',
          position: 0,
          label: 'x',
          item_type: 'number',
          required: false,
          unit: 'kg',
          default_value: '3',
        },
      ],
    },
    {
      items: [
        {
          id: 'item',
          position: 1,
          label: 'x',
          item_type: 'text',
          required: false,
          unit: '',
          default_value: null,
        },
      ],
    },
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...preset, ...extra }))),
    );
    await expect(getTaskPreset('id')).rejects.toThrow('서버 응답');
  }
});
