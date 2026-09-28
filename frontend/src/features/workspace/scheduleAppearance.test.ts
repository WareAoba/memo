import { expect, it } from 'vitest';
import type { ScheduleDetail } from '../../api/schedules';
import { emptyFields } from '../../api/works';
import { scheduleAppearance } from './scheduleAppearance';

const schedule: ScheduleDetail = {
  id: 's',
  entity_id: 'e',
  title: 'Work',
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
it('uses schedule-zone start inclusive and end exclusive boundaries', () => {
  expect(scheduleAppearance(schedule, new Date('2026-09-23T23:59:00Z')).color).toBe(
    'var(--status-upcoming)',
  );
  expect(scheduleAppearance(schedule, new Date('2026-09-24T00:00:00Z')).color).toBe(
    'var(--status-current)',
  );
  expect(scheduleAppearance(schedule, new Date('2026-09-24T01:00:00Z')).color).toBe(
    'var(--status-overdue)',
  );
  expect(
    scheduleAppearance({ ...schedule, status: 'completed' }, new Date('2026-09-24T01:00:00Z'))
      .state,
  ).toBe('completed');
});
it('keeps overnight work yellow until its actual end date', () => {
  const overnight = { ...schedule, start_time: '23:00', end_date: '2026-09-25', end_time: '01:00' };
  expect(scheduleAppearance(overnight, new Date('2026-09-24T15:30:00Z')).state).toBe('current');
  expect(scheduleAppearance(overnight, new Date('2026-09-24T16:00:00Z')).state).toBe('overdue');
});
it('darkens green with completed tasks without counting skipped tasks as completed', () => {
  const task = {
    id: 't',
    name_snapshot: 'Task',
    status: 'completed',
    execution_notes: '',
    default_notes_snapshot: '',
    source_task_preset_version: 1,
    items: [],
  };
  const now = new Date('2026-09-24T12:00:00Z');
  const partial = scheduleAppearance(
    { ...schedule, tasks: [task, { ...task, id: 'u', status: 'pending' }] },
    now,
  );
  expect(partial.state).toBe('overdue');
  expect(partial.ratio).toBe(0.5);
  expect(partial.green).toContain('hsl(140 var(--progress-saturation) 71%)');
  const done = scheduleAppearance({ ...schedule, status: 'completed', tasks: [task] }, now);
  expect(done.color).toContain('hsl(140 var(--progress-saturation) 56%)');
  expect(
    scheduleAppearance(
      { ...schedule, status: 'completed', tasks: [task, { ...task, status: 'skipped' }] },
      now,
    ).ratio,
  ).toBe(0.5);
});

it('leaves untimed schedules pending and marks start-only schedules overdue after their instant', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  expect(scheduleAppearance({ ...schedule, start_time: '', end_time: '' }, now).state).toBe(
    'upcoming',
  );
  expect(scheduleAppearance({ ...schedule, end_time: '' }, now).state).toBe('overdue');
  expect(
    scheduleAppearance({ ...schedule, start_time: '', end_time: '', status: 'completed' }, now)
      .state,
  ).toBe('completed');
});

it.each(['2026-09-23T23:59:00Z', '2026-09-24T00:30:00Z', '2026-09-24T01:00:00Z'])(
  'prioritizes completion and restores time state on reopen at %s',
  (instant) => {
    const now = new Date(instant);
    const done = scheduleAppearance({ ...schedule, status: 'completed' }, now);
    expect(done.state).toBe('completed');
    expect(done.color).toBe(done.green);
    expect(scheduleAppearance(schedule, now).state).not.toBe('completed');
    expect(scheduleAppearance({ ...schedule, status: 'cancelled' }, now).state).toBe('cancelled');
  },
);

it.each([
  ['2026-09-23T23:59:00Z', 'upcoming'],
  ['2026-09-24T00:00:00Z', 'overdue'],
  ['2026-09-24T00:01:00Z', 'overdue'],
])('uses the schedule timezone for a single marker at %s', (instant, state) => {
  const single = { ...schedule, end_time: '' };
  expect(scheduleAppearance(single, new Date(instant)).state).toBe(state);
  expect(scheduleAppearance({ ...single, status: 'completed' }, new Date(instant)).state).toBe(
    'completed',
  );
});
