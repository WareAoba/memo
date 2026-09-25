import { LocalizedError } from '../i18n/errors';
import { requestJson, record, parsePage } from './client';
import type { Page } from './client';
export type PresetItem = {
  id?: string | null;
  position: number;
  label: string;
  item_type: 'checkbox' | 'text' | 'number';
  required: boolean;
  default_value: boolean | string | number | null;
  unit: string;
};
export type TaskPresetFields = {
  group_name?: string;
  name: string;
  default_notes: string;
  tags: string[];
  archived: boolean;
  items: PresetItem[];
};
export type TaskPreset = TaskPresetFields & {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type TaskPresetSummary = Omit<TaskPreset, 'items'> & { item_count: number };
export type TaskPresetList = Page<TaskPresetSummary>;
export const emptyFields: TaskPresetFields = {
  name: '',
  default_notes: '',
  tags: [],
  archived: false,
  items: [],
};
function validItem(value: unknown, index: number): boolean {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    value.position !== index ||
    typeof value.label !== 'string' ||
    typeof value.unit !== 'string' ||
    typeof value.required !== 'boolean'
  )
    return false;
  const d = value.default_value;
  return value.item_type === 'checkbox'
    ? value.unit === '' && (d === null || typeof d === 'boolean')
    : value.item_type === 'text'
      ? value.unit === '' && (d === null || typeof d === 'string')
      : value.item_type === 'number' &&
        (d === null || (typeof d === 'number' && Number.isFinite(d)));
}
const request = (path: string, method = 'GET', body?: unknown, signal?: AbortSignal) =>
  requestJson(path, method, body, signal, 'taskPresets.taskNotFound');
function preset(value: unknown): TaskPreset {
  if (
    !record(value) ||
    (value.group_name !== undefined && typeof value.group_name !== 'string') ||
    !['id', 'created_at', 'updated_at'].every((k) => typeof value[k] === 'string') ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !Array.isArray(value.items) ||
    !value.items.every(validItem) ||
    !Object.entries(emptyFields)
      .filter(([k]) => k !== 'items')
      .every(([k, v]) =>
        v === null
          ? value[k] === null || typeof value[k] === 'string'
          : Array.isArray(v)
            ? Array.isArray(value[k]) && value[k].every((x) => typeof x === 'string')
            : typeof value[k] === typeof v,
      )
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return value as TaskPreset;
}
export async function listTaskPresets(
  q: string,
  archived: boolean,
  offset: number,
  signal?: AbortSignal,
  limit = 20,
  group?: string,
): Promise<TaskPresetList> {
  const value = await request(
    '/api/task-presets?' +
      new URLSearchParams({
        q,
        archived: String(archived),
        offset: String(offset),
        limit: String(limit),
        ...(group === undefined ? {} : { group_name: group }),
      }),
    'GET',
    undefined,
    signal,
  );
  return parsePage(value, (item): TaskPresetSummary => {
    if (
      !record(item) ||
      !Number.isInteger(item.item_count) ||
      Number(item.item_count) < 0 ||
      Number(item.item_count) > 100
    )
      throw new LocalizedError('client.couldNotReadTheServerResponse');
    const parsed = preset({ ...item, items: [] });
    return {
      group_name: parsed.group_name,
      id: parsed.id,
      name: parsed.name,
      default_notes: parsed.default_notes,
      tags: parsed.tags,
      archived: parsed.archived,
      version: parsed.version,
      created_at: parsed.created_at,
      updated_at: parsed.updated_at,
      item_count: Number(item.item_count),
    };
  });
}
export async function getTaskPreset(id: string, signal?: AbortSignal): Promise<TaskPreset> {
  return preset(
    await request('/api/task-presets/' + encodeURIComponent(id), 'GET', undefined, signal),
  );
}
export async function saveTaskPreset(
  fields: Partial<TaskPresetFields>,
  id?: string,
): Promise<TaskPreset> {
  return preset(
    await request(
      '/api/task-presets' + (id ? '/' + encodeURIComponent(id) : ''),
      id ? 'PATCH' : 'POST',
      fields,
    ),
  );
}
export async function archiveTaskPreset(id: string): Promise<void> {
  await request('/api/task-presets/' + encodeURIComponent(id), 'DELETE');
}
