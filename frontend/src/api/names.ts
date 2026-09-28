import { getJson } from './client';
import { LocalizedError } from '../i18n/errors';

export async function getNames(path: string, signal?: AbortSignal): Promise<string[]> {
  const value = await getJson(path, signal);
  if (!Array.isArray(value) || !value.every((name) => typeof name === 'string'))
    throw new LocalizedError('useNames.couldNotLoadTheList');
  return value;
}
