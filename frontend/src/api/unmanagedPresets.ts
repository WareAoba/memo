import { requestJson, record } from './client';
import { LocalizedError } from '../i18n/errors';

export async function suggestUnmanaged(kind: 'work' | 'task', name: string, signal: AbortSignal) {
  const result = await requestJson(
    `/api/unmanaged-presets/${kind}?` + new URLSearchParams({ q: name }),
    'GET',
    undefined,
    signal,
  );
  if (
    !Array.isArray(result) ||
    !result.every(
      (item) => record(item) && typeof item.id === 'string' && typeof item.name === 'string',
    )
  ) {
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  }
  return result as { id: string; name: string }[];
}
