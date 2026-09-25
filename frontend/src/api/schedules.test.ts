import { afterEach, expect, it, vi } from 'vitest';
import { getDaySchedules, searchSchedules } from './schedules';
import { emptyFields } from './works';
afterEach(() => vi.unstubAllGlobals());
it('searches all dates without archive filters', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, offset: 20, limit: 20 })),
    );
  vi.stubGlobal('fetch', fetcher);
  await searchSchedules('  100% 메모  ', 20);
  const params = new URL(fetcher.mock.calls[0]![0], 'http://localhost').searchParams;
  expect(params.get('q')).toBe('100% 메모');
  expect(params.has('include_archived')).toBe(false);
  expect(params.has('archived')).toBe(false);
  expect(params.get('offset')).toBe('20');
  expect(params.has('from')).toBe(false);
  expect(params.has('include_details')).toBe(false);
});
const item = {
  id: 's',
  entity_id: 'e',
  title: '',
  scheduled_date: '2026-09-24',
  end_date: '2026-09-24',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  status: 'planned',
  notes: '',
  created_at: '',
  updated_at: '',
  entity_snapshot: emptyFields,
  tasks: [],
};
it('loads all date pages before returning the day summary', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: Array.from({ length: 20 }, (_, i) => ({ ...item, id: String(i) })),
          revision: 1,
          total: 21,
          limit: 20,
          offset: 0,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [item], revision: 1, total: 21, limit: 20, offset: 20 }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  expect(await getDaySchedules('2026-09-24')).toHaveLength(21);
  expect(fetcher.mock.calls[1]![0]).toContain('offset=20');
  expect(fetcher.mock.calls[0]![0]).toContain('include_details=true');
});
it('rejects malformed snapshots instead of displaying a false empty summary', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ ...item, entity_snapshot: { name: 'bad' } }],
          revision: 1,
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
    ),
  );
  await expect(getDaySchedules('2026-09-24')).rejects.toThrow('서버 응답');
});

it('restarts a changed list without leaking partial pages into the result', async () => {
  const row = (id: string) => ({ ...item, id });
  const response = (ids: string[], total: number, offset: number, revision: number) =>
    new Response(JSON.stringify({ items: ids.map(row), total, offset, limit: 20, revision }));
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        Array.from({ length: 20 }, (_, i) => String(i)),
        22,
        0,
        1,
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'SCHEDULE_LIST_CHANGED' } }), { status: 409 }),
    )
    .mockResolvedValueOnce(
      response(
        Array.from({ length: 20 }, (_, i) => String(i + 1)),
        21,
        0,
        2,
      ),
    )
    .mockResolvedValueOnce(response(['21'], 21, 20, 2));
  vi.stubGlobal('fetch', fetcher);
  const rows = await getDaySchedules('2026-09-24');
  expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 21 }, (_, i) => String(i + 1)));
  expect(fetcher.mock.calls[1]![0]).toContain('revision=1');
  expect(fetcher.mock.calls[2]![0]).toContain('offset=0');
  expect(fetcher.mock.calls[3]![0]).toContain('revision=2');
});
it('bounds retries when every list snapshot conflicts', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'SCHEDULE_LIST_CHANGED' } }), { status: 409 }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(getDaySchedules('2026-09-24')).rejects.toThrow('계속 변경');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not silently render duplicate records in a malformed page', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [item, item], total: 2, limit: 20, offset: 0, revision: 1 }),
        ),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(getDaySchedules('2026-09-24')).rejects.toThrow('계속 변경');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
