import { requestJson, record } from './client';
import { LocalizedError } from '../i18n/errors';

export type Track = { id: string; name: string };
export type Tracks = { items: Track[]; limit: number; default_id: string };
function parse(value: unknown): Track {
  if (!record(value) || typeof value.id !== 'string' || typeof value.name !== 'string')
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return { id: value.id, name: value.name };
}
export async function listTracks(): Promise<Tracks> {
  const value = await requestJson('/api/tracks');
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !Number.isSafeInteger(value.limit) ||
    Number(value.limit) < 1 ||
    typeof value.default_id !== 'string'
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  const items = value.items.map(parse);
  if (!items.some((item) => item.id === value.default_id))
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return { items, limit: Number(value.limit), default_id: value.default_id };
}
export async function saveTrack(name: string, id?: string) {
  return parse(
    await requestJson(
      '/api/tracks' + (id ? '/' + encodeURIComponent(id) : ''),
      id ? 'PATCH' : 'POST',
      { name },
    ),
  );
}
