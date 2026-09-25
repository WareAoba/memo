import { LocalizedError } from '../i18n/errors';
import { record, requestJson } from './client';
export type WorkTask = { id: string; name: string; archived: boolean; position: number };
async function request(id: string, ids?: string[], signal?: AbortSignal): Promise<WorkTask[]> {
  const value = await requestJson(
    '/api/entities/' + encodeURIComponent(id) + '/task-presets',
    ids ? 'PUT' : 'GET',
    ids ? { task_preset_ids: ids } : undefined,
    signal,
  );
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !value.items.every(
      (item, index) =>
        record(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.archived === 'boolean' &&
        item.position === index,
    ) ||
    new Set(value.items.map((item) => item.id)).size !== value.items.length
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return value.items as WorkTask[];
}
export const getWorkTasks = (id: string, signal?: AbortSignal) => request(id, undefined, signal);
export const saveWorkTasks = (id: string, ids: string[]) => request(id, ids);
