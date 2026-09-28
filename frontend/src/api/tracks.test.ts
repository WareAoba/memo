import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from './client';
import { currentTrackScope, hasTrackWrites, selectTrackScope } from './trackScope';
import { listTracks, saveTrack } from './tracks';
import { photoUrl } from './photos';
import { readSchedules } from './scheduleReads';

afterEach(() => {
  selectTrackScope('', '');
  vi.unstubAllGlobals();
});
it('scopes data requests and image URLs while leaving app settings and reminders global', async () => {
  const fetch = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  selectTrackScope('account', 'track-a');
  await requestJson('/api/entities');
  expect(fetch.mock.calls[0]).toEqual([
    '/api/entities',
    expect.objectContaining({ headers: expect.objectContaining({ 'X-Track-Id': 'track-a' }) }),
  ]);
  for (const path of ['/api/reminders', '/api/push/config', '/api/settings', '/api/tracks']) {
    await requestJson(path);
    expect(fetch.mock.calls.at(-1)).toEqual([
      path,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    ]);
  }
  expect(photoUrl('photo')).toBe('/api/photos/photo?track_id=track-a');
});
it('rejects a late response even when switching away and back, without leaking a write lock', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  selectTrackScope('account', 'a');
  const request = requestJson('/api/entities/id', 'PATCH', { name: 'old' });
  expect(hasTrackWrites()).toBe(true);
  selectTrackScope('account', 'b');
  selectTrackScope('account', 'a');
  finish(new Response('{}'));
  await expect(request).rejects.toThrow();
  expect(hasTrackWrites()).toBe(false);
});
it('never shares pending schedule reads between tracks', async () => {
  let finish!: (value: string) => void;
  const read = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  selectTrackScope('account', 'a');
  const a = readSchedules('same', read);
  const finishA = finish;
  selectTrackScope('account', 'b');
  const b = readSchedules('same', read);
  expect(read).toHaveBeenCalledTimes(2);
  finishA('a');
  finish('b');
  expect(await a).toBe('a');
  expect(await b).toBe('b');
});
it('validates the track list and surfaces the server creation limit', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], limit: 3, default_id: 'a' })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'TRACK_LIMIT' } }), { status: 409 }),
      ),
  );
  await expect(listTracks()).rejects.toThrow();
  await expect(saveTrack('Fourth')).rejects.toMatchObject({
    code: 'TRACK_LIMIT',
    messageKey: 'Tracks.limitReached',
  });
  expect(currentTrackScope().trackId).toBe('');
});
