import { LocalizedError } from '../i18n/errors';
import type { ReminderFields } from './reminderFields';
import { emptyFields, type WorkFields } from './works';
import { ApiError, parsePage, record, requestJson } from './client';
import type { PresetItem } from './taskPresets';
import { scheduleColors, type ScheduleColor } from './scheduleColors';
export type { ScheduleColor } from './scheduleColors';
export type ScheduleFields = ReminderFields & {
  title: string;
  scheduled_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  notes: string;
  color?: ScheduleColor;
};
export type Schedule = ScheduleFields & {
  id: string;
  entity_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
export type ScheduleDetail = Schedule & {
  entity_snapshot: WorkFields;
  tasks: {
    id: string;
    status: string;
    execution_notes: string;
    name_snapshot: string;
    name_template_snapshot?: string;
    parameter_values?: Record<string, string>;
    default_notes_snapshot: string;
    source_task_preset_version: number;
    items: {
      id: string;
      definition: PresetItem;
      value_boolean: boolean | null;
      value_text: string | null;
      value_number: number | null;
      completed: boolean;
    }[];
  }[];
};
export function parseSchedule(v: unknown): Schedule {
  if (
    !record(v) ||
    (v.color !== undefined && !scheduleColors.includes(v.color as ScheduleColor)) ||
    !(v.entity_id === null || typeof v.entity_id === 'string') ||
    ![
      'id',
      'title',
      'scheduled_date',
      'end_date',
      'start_time',
      'end_time',
      'time_zone',
      'notes',
      'status',
      'created_at',
      'updated_at',
    ].every((k) => typeof v[k] === 'string')
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return v as Schedule;
}
function detail(v: unknown): ScheduleDetail {
  parseSchedule(v);
  if (
    !record(v) ||
    !record(v.entity_snapshot) ||
    !Object.entries(emptyFields).every(([k, expected]) => {
      const actual = (v.entity_snapshot as Record<string, unknown>)[k];
      return expected === null
        ? actual === null || typeof actual === 'string'
        : Array.isArray(expected)
          ? Array.isArray(actual) && actual.every((x) => typeof x === 'string')
          : typeof actual === typeof expected;
    }) ||
    !Array.isArray(v.tasks) ||
    !v.tasks.every(
      (t) =>
        record(t) &&
        typeof t.id === 'string' &&
        ['pending', 'in_progress', 'completed', 'skipped'].includes(String(t.status)) &&
        typeof t.execution_notes === 'string' &&
        typeof t.name_snapshot === 'string' &&
        (t.name_template_snapshot === undefined || typeof t.name_template_snapshot === 'string') &&
        (t.parameter_values === undefined ||
          (record(t.parameter_values) &&
            Object.values(t.parameter_values).every((v) => typeof v === 'string'))) &&
        typeof t.default_notes_snapshot === 'string' &&
        Number.isInteger(t.source_task_preset_version) &&
        Array.isArray(t.items) &&
        t.items.every(
          (i) =>
            record(i) &&
            typeof i.id === 'string' &&
            typeof i.completed === 'boolean' &&
            (i.value_boolean === null || typeof i.value_boolean === 'boolean') &&
            (i.value_text === null || typeof i.value_text === 'string') &&
            (i.value_number === null ||
              (typeof i.value_number === 'number' && Number.isFinite(i.value_number))) &&
            record(i.definition) &&
            typeof i.definition.label === 'string' &&
            typeof i.definition.required === 'boolean' &&
            typeof i.definition.unit === 'string' &&
            ['checkbox', 'text', 'number'].includes(String(i.definition.item_type)) &&
            (i.definition.default_value === null ||
              ['boolean', 'string', 'number'].includes(typeof i.definition.default_value)),
        ),
    )
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  return v as ScheduleDetail;
}
export async function listSchedules(date: string, offset: number, signal?: AbortSignal) {
  return parsePage(
    await requestJson(
      '/api/schedules?' +
        new URLSearchParams({
          ...(date ? { date } : {}),
          offset: String(offset),
          limit: '20',
        }),
      'GET',
      undefined,
      signal,
    ),
    parseSchedule,
  );
}
export async function getSchedule(id: string, signal?: AbortSignal) {
  return detail(
    await requestJson('/api/schedules/' + encodeURIComponent(id), 'GET', undefined, signal),
  );
}
export async function searchSchedules(q: string, offset: number, signal?: AbortSignal) {
  return parsePage(
    await requestJson(
      '/api/schedules?' +
        new URLSearchParams({
          q: q.trim(),
          limit: '20',
          offset: String(offset),
        }),
      'GET',
      undefined,
      signal,
    ),
    parseSchedule,
  );
}
function presetReference(id: string) {
  return id.startsWith('name:') ? { name: id.slice(5) } : id;
}
export async function saveSchedule(
  fields: Partial<ScheduleFields> & {
    entity_id?: string;
    task_preset_ids?: string[];
    task_customizations?: Record<string, TaskCustomization>;
  },
  id?: string,
) {
  return detail(
    await requestJson(
      '/api/schedules' + (id ? '/' + encodeURIComponent(id) : ''),
      id ? 'PATCH' : 'POST',
      id
        ? fields
        : {
            ...fields,
            ...(fields.entity_id?.startsWith('name:')
              ? { entity_id: undefined, entity_name: fields.entity_id.slice(5) }
              : {}),
            task_preset_ids: fields.task_preset_ids?.map(presetReference),
          },
    ),
  );
}
export async function getDaySchedules(date: string, signal?: AbortSignal) {
  return getRangeSchedules(date, date, signal);
}

export async function getRangeSchedules(from: string, to: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const items: ScheduleDetail[] = [];
    const ids = new Set<string>();
    let revision: number | undefined;
    let total: number | undefined;
    try {
      while (true) {
        const raw = await requestJson(
          '/api/schedules?' +
            new URLSearchParams({
              from,
              to,
              include_details: 'true',
              limit: '20',
              offset: String(items.length),
              ...(revision === undefined ? {} : { revision: String(revision) }),
            }),
          'GET',
          undefined,
          signal,
        );
        const page = parsePage(raw, detail);
        if (!record(raw) || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0)
          throw new LocalizedError('schedules.couldNotReadTheScheduleListVersion');
        if (
          (revision !== undefined && revision !== raw.revision) ||
          (total !== undefined && total !== page.total) ||
          page.offset !== items.length ||
          page.items.some((item) => ids.has(item.id))
        )
          throw new ApiError('schedules.theScheduleListHasChanged', 409, 'SCHEDULE_LIST_CHANGED');
        revision = Number(raw.revision);
        total = page.total;
        for (const item of page.items) {
          if (ids.has(item.id))
            throw new ApiError('schedules.theScheduleListHasChanged', 409, 'SCHEDULE_LIST_CHANGED');
          ids.add(item.id);
          items.push(item);
        }
        if (items.length === total) return items;
        if (items.length > total || !page.items.length)
          throw new ApiError('schedules.theScheduleListHasChanged', 409, 'SCHEDULE_LIST_CHANGED');
      }
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'SCHEDULE_LIST_CHANGED') throw e;
    }
  }
  throw new LocalizedError('schedules.theScheduleListKeepsChangingTryAgain');
}

export type ScheduleTask = ScheduleDetail['tasks'][number];
export type TaskCustomization = { parameters?: Record<string, string>; execution_notes?: string };
export type ExecutionItem = ScheduleTask['items'][number];
export async function updateTask(
  id: string,
  changes: {
    status?: string;
    execution_notes?: string;
    name?: string;
    parameters?: Record<string, string>;
  },
) {
  return detail(
    await requestJson('/api/schedule-tasks/' + encodeURIComponent(id), 'PATCH', changes),
  );
}
export async function updateItem(id: string, value: boolean | string | number | null) {
  return detail(
    await requestJson('/api/schedule-task-items/' + encodeURIComponent(id), 'PATCH', { value }),
  );
}
export async function updateScheduleStatus(id: string, status: string) {
  return detail(
    await requestJson('/api/schedules/' + encodeURIComponent(id) + '/status', 'PATCH', { status }),
  );
}

export async function completeSchedule(id: string) {
  return detail(
    await requestJson('/api/schedules/' + encodeURIComponent(id) + '/complete', 'POST', {}),
  );
}
export async function addScheduleTask(
  id: string,
  taskPresetId: string,
  customization?: TaskCustomization,
) {
  return detail(
    await requestJson('/api/schedules/' + encodeURIComponent(id) + '/tasks', 'POST', {
      task_preset_id: presetReference(taskPresetId),
      ...customization,
    }),
  );
}

export async function reopenSchedule(id: string) {
  return detail(
    await requestJson('/api/schedules/' + encodeURIComponent(id) + '/reopen', 'POST', {}),
  );
}
export async function deleteSchedule(id: string) {
  await requestJson('/api/schedules/' + encodeURIComponent(id), 'DELETE');
}
export async function deleteScheduleTask(id: string) {
  return detail(await requestJson('/api/schedule-tasks/' + encodeURIComponent(id), 'DELETE'));
}
