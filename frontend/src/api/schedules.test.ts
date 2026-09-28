import { afterEach, expect, it, vi } from 'vitest';
import {
  getDaySchedules,
  getSchedule,
  getRangeScheduleSummaries,
  searchSchedules,
  saveSchedule,
  updateTask,
  updateItem,
  updateScheduleStatus,
  completeSchedule,
  reopenSchedule,
  addScheduleTask,
  deleteScheduleTask,
  deleteSchedule,
} from './schedules';
import { requestJson } from './client';
import { publishScheduleChange, scheduleChange } from './scheduleChanges';
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
  expect(params.get('limit')).toBe('20');
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
          items: Array.from({ length: 100 }, (_, i) => ({ ...item, id: String(i) })),
          revision: 1,
          total: 101,
          limit: 100,
          offset: 0,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [item], revision: 1, total: 101, limit: 100, offset: 100 }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  expect(await getDaySchedules('2026-09-24')).toHaveLength(101);
  expect(fetcher.mock.calls[1]![0]).toContain('offset=100');
  expect(fetcher.mock.calls[0]![0]).toContain('include_details=true');
  expect(fetcher.mock.calls[0]![0]).toContain('limit=100');
  expect(fetcher).toHaveBeenCalledTimes(2);
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
          limit: 100,
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
    new Response(JSON.stringify({ items: ids.map(row), total, offset, limit: 100, revision }));
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        Array.from({ length: 100 }, (_, i) => String(i)),
        102,
        0,
        1,
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'SCHEDULE_LIST_CHANGED' } }), { status: 409 }),
    )
    .mockResolvedValueOnce(
      response(
        Array.from({ length: 100 }, (_, i) => String(i + 1)),
        101,
        0,
        2,
      ),
    )
    .mockResolvedValueOnce(response(['101'], 101, 100, 2));
  vi.stubGlobal('fetch', fetcher);
  const rows = await getDaySchedules('2026-09-24');
  expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 101 }, (_, i) => String(i + 1)));
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

const pageResponse = (items: unknown[] = [item]) =>
  new Response(JSON.stringify({ items, total: items.length, offset: 0, limit: 20, revision: 1 }));

it('reads 1000 calendar summaries in ten consistent pages', async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const offset = Number(params.get('offset'));
    const limit = Number(params.get('limit'));
    expect(params.get('include_details')).toBe('false');
    expect(limit).toBe(100);
    expect(params.get('revision')).toBe(offset ? '7' : null);
    return new Response(
      JSON.stringify({
        items: Array.from({ length: Math.min(limit, 1000 - offset) }, (_, i) => ({
          ...item,
          id: String(offset + i),
        })),
        total: 1000,
        offset,
        limit,
        revision: 7,
      }),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const rows = await getRangeScheduleSummaries('2026-01-01', '2026-12-31');
  expect(rows.map((row) => row.id)).toEqual(Array.from({ length: 1000 }, (_, i) => String(i)));
  expect(fetcher).toHaveBeenCalledTimes(10);
});

it('shares concurrent day reads but a later refresh performs a new request', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockImplementation(() => Promise.resolve(pageResponse()));
  vi.stubGlobal('fetch', fetcher);
  const today = getDaySchedules('2026-09-24');
  const sticky = getDaySchedules('2026-09-24');
  expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(pageResponse());
  expect(await today).toEqual(await sticky);
  await getDaySchedules('2026-09-24');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('cancels each reader independently and cancels transport when the last reader leaves', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const first = new AbortController(),
    second = new AbortController();
  const a = getSchedule('s', first.signal),
    b = getSchedule('s', second.signal);
  const rejected = expect(a).rejects.toMatchObject({ name: 'AbortError' });
  first.abort();
  await rejected;
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(false);
  resolve(new Response(JSON.stringify(item)));
  expect(await b).toEqual(item);
  const last = new AbortController();
  const c = getSchedule('s', last.signal);
  const cancelled = expect(c).rejects.toMatchObject({ name: 'AbortError' });
  last.abort();
  await cancelled;
  expect(fetcher.mock.calls[1]![1].signal.aborted).toBe(true);
  resolve(new Response(JSON.stringify(item)));
});

it('does not join a read started before a successful mutation or reset', async () => {
  const resolvers: ((response: Response) => void)[] = [];
  const fetcher = vi
    .fn()
    .mockImplementation(() => new Promise<Response>((done) => resolvers.push(done)));
  vi.stubGlobal('fetch', fetcher);
  const old = getSchedule('s');
  publishScheduleChange({ kind: 'reset' });
  const fresh = getSchedule('s');
  expect(fetcher).toHaveBeenCalledTimes(2);
  resolvers[1]!(new Response(JSON.stringify({ ...item, title: 'new' })));
  expect((await fresh).title).toBe('new');
  resolvers[0]!(new Response(JSON.stringify(item)));
  await old;
});

it('shares failures only while pending and permits a fresh retry', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 500 }))
    .mockImplementation(() => Promise.resolve(pageResponse()));
  vi.stubGlobal('fetch', fetcher);
  const results = await Promise.allSettled([
    getDaySchedules('2026-09-24'),
    getDaySchedules('2026-09-24'),
  ]);
  expect(results.every((result) => result.status === 'rejected')).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await getDaySchedules('2026-09-24');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('loads summaries without task snapshots and keeps summary and detail reads separate', async () => {
  const summary = { ...item, entity_snapshot: undefined, tasks: undefined, entity_name: '워크' };
  const fetcher = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(pageResponse(url.includes('include_details=false') ? [summary] : [item])),
    );
  vi.stubGlobal('fetch', fetcher);
  const [summaries, details] = await Promise.all([
    getRangeScheduleSummaries('2026-09-24', '2026-09-24'),
    getDaySchedules('2026-09-24'),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(summaries[0]).not.toHaveProperty('tasks');
  expect(summaries[0]?.entity_name).toBe('워크');
  expect(details[0]?.tasks).toEqual([]);
});

it.each([
  () => saveSchedule({ notes: 'saved' }, 's'),
  () => saveSchedule({ title: 'new' }),
  () => updateTask('t', { status: 'completed' }),
  () => updateItem('i', true),
  () => updateScheduleStatus('s', 'cancelled'),
  () => completeSchedule('s'),
  () => reopenSchedule('s'),
  () => addScheduleTask('s', 'preset'),
  () => deleteScheduleTask('t'),
])('publishes a parsed schedule after a successful domain write', async (write) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(item)))),
  );
  const listener = vi.fn();
  window.addEventListener('schedules-changed', listener);
  try {
    await write();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(scheduleChange(listener.mock.calls[0]![0])).toEqual({
      kind: 'saved',
      id: 's',
      schedule: item,
    });
  } finally {
    window.removeEventListener('schedules-changed', listener);
  }
});

it('keeps transport domain-neutral and emits no success for failed or malformed writes', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response('', { status: 500 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const listener = vi.fn();
  window.addEventListener('schedules-changed', listener);
  try {
    await requestJson('/api/schedules', 'POST', {});
    await expect(saveSchedule({})).rejects.toThrow();
    await expect(deleteSchedule('s')).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
    await deleteSchedule('s');
    expect(scheduleChange(listener.mock.calls[0]![0])).toEqual({ kind: 'deleted', id: 's' });
  } finally {
    window.removeEventListener('schedules-changed', listener);
  }
});
