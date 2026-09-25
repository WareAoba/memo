import { LocalizedError } from '../i18n/errors';
import { requestJson, record, parsePage } from './client';
import type { Page } from './client';
export type WorkFields = {
  custom_fields?: { name: string; value: string }[];
  name: string;
  reference_code: string;
  address: string;
  contact_name: string;
  contact_info: string;
  advance_contact_required: boolean;
  notice_required: boolean;
  default_work_start_time: string | null;
  default_work_end_time: string | null;
  access_instructions: string;
  parking_info: string;
  special_notes: string;
  general_notes: string;
  archived: boolean;
  tags: string[];
};
export type Work = WorkFields & { id: string; created_at: string; updated_at: string };
export type WorkList = Page<Work>;
export const emptyFields: WorkFields = {
  name: '',
  reference_code: '',
  address: '',
  contact_name: '',
  contact_info: '',
  advance_contact_required: false,
  notice_required: false,
  default_work_start_time: null,
  default_work_end_time: null,
  access_instructions: '',
  parking_info: '',
  special_notes: '',
  general_notes: '',
  archived: false,
  tags: [],
};
const request = (path: string, method = 'GET', body?: unknown, signal?: AbortSignal) =>
  requestJson(path, method, body, signal, 'works.workNotFound');
function work(value: unknown): Work {
  if (
    !record(value) ||
    !['id', 'created_at', 'updated_at'].every((k) => typeof value[k] === 'string') ||
    !Object.entries(emptyFields).every(([k, v]) =>
      v === null
        ? value[k] === null || typeof value[k] === 'string'
        : Array.isArray(v)
          ? Array.isArray(value[k]) && value[k].every((x) => typeof x === 'string')
          : typeof value[k] === typeof v,
    )
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  if (
    value.custom_fields !== undefined &&
    (!Array.isArray(value.custom_fields) ||
      !value.custom_fields.every(
        (f) => record(f) && typeof f.name === 'string' && typeof f.value === 'string',
      ))
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return value as Work;
}
export async function listWorks(
  q: string,
  archived: boolean,
  offset: number,
  signal?: AbortSignal,
  limit = 20,
): Promise<WorkList> {
  const value = await request(
    '/api/entities?' +
      new URLSearchParams({
        q,
        archived: String(archived),
        offset: String(offset),
        limit: String(limit),
      }),
    'GET',
    undefined,
    signal,
  );
  return parsePage(value, work);
}
export async function getWork(id: string, signal?: AbortSignal): Promise<Work> {
  return work(await request('/api/entities/' + encodeURIComponent(id), 'GET', undefined, signal));
}
export async function saveWork(fields: Partial<WorkFields>, id?: string): Promise<Work> {
  return work(
    await request(
      '/api/entities' + (id ? '/' + encodeURIComponent(id) : ''),
      id ? 'PATCH' : 'POST',
      fields,
    ),
  );
}
export async function archiveWork(id: string): Promise<void> {
  await request('/api/entities/' + encodeURIComponent(id), 'DELETE');
}
export async function initializeLocalUser(): Promise<string> {
  const result = await request('/api/local-user', 'POST', {
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (!record(result) || typeof result.time_zone !== 'string')
    throw new LocalizedError('works.couldNotDetermineTheTimeZone');
  return result.time_zone;
}
