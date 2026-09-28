import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  completeSchedule,
  getDaySchedules,
  getSchedule,
  reopenSchedule,
  updateScheduleStatus,
  type ScheduleDetail,
} from '../../api/schedules';
import { emptyFields } from '../../api/works';
import { ApiError } from '../../api/client';
import { Today } from '../workspace/Today';
import { SavedScheduleCard } from '../workspace/SavedScheduleCard';
import { StickySchedules } from '../sticky/StickySchedules';
import { ScheduleView } from './Schedules';

vi.mock('../../api/schedules');
vi.mock('./Photos', () => ({ Photos: () => null }));

const schedule: ScheduleDetail = {
  id: 's',
  entity_id: null,
  title: 'Work',
  status: 'planned',
  scheduled_date: '2026-09-27',
  end_date: '2026-09-27',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  created_at: '',
  updated_at: '',
  entity_snapshot: { ...emptyFields, name: 'Work' },
  tasks: [
    {
      id: 't',
      name_snapshot: 'Task',
      status: 'pending',
      execution_notes: 'keep',
      default_notes_snapshot: '',
      source_task_preset_version: 1,
      items: [
        {
          id: 'i',
          definition: {
            position: 0,
            label: 'Required',
            item_type: 'text',
            required: true,
            unit: '',
            default_value: null,
          },
          value_text: 'ready',
          value_boolean: null,
          value_number: null,
          completed: true,
        },
      ],
    },
  ],
};
function Card({ initial }: { initial: ScheduleDetail }) {
  const [value, setValue] = useState(initial);
  return <SavedScheduleCard value={value} onChange={setValue} />;
}
const surfaces = ['today', 'daily', 'detail', 'sticky'] as const;
function show(surface: (typeof surfaces)[number], value: ScheduleDetail) {
  vi.mocked(getSchedule).mockResolvedValue(value);
  vi.mocked(getDaySchedules).mockResolvedValue([value]);
  if (surface === 'today')
    render(<Today today={value.scheduled_date} timeZone={value.time_zone} />);
  if (surface === 'daily') render(<Card initial={value} />);
  if (surface === 'detail') render(<ScheduleView id={value.id} modal />);
  if (surface === 'sticky') render(<StickySchedules kind="schedule" target={value.id} />);
}
async function control(surface: (typeof surfaces)[number], completed = false) {
  const name =
    surface === 'detail'
      ? '스케줄 완료'
      : surface === 'sticky'
        ? 'Work 완료 전환'
        : completed
          ? 'Work 완료 취소'
          : 'Work 모든 태스크 완료';
  return screen.findByRole(surface === 'today' ? 'button' : 'checkbox', { name });
}
beforeEach(() => {
  vi.resetAllMocks();
  // Status PATCH cannot finish pending tasks, even when their required values are present.
  vi.mocked(updateScheduleStatus).mockRejectedValue(new Error('pending tasks'));
});
it.each(surfaces)(
  '%s completes pending tasks and reopens using the same contract',
  async (surface) => {
    vi.mocked(completeSchedule).mockResolvedValue({
      ...schedule,
      status: 'completed',
      tasks: schedule.tasks.map((task) => ({ ...task, status: 'completed' })),
    });
    vi.mocked(reopenSchedule).mockResolvedValue(schedule);
    show(surface, schedule);
    fireEvent.click(await control(surface));
    await waitFor(() => expect(completeSchedule).toHaveBeenCalledWith('s'));
    const done = await control(surface, true);
    if (surface !== 'today') await waitFor(() => expect(done).toBeChecked());
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(reopenSchedule).toHaveBeenCalledWith('s'));
    if (surface !== 'today') await waitFor(() => expect(done).not.toBeChecked());
    expect(updateScheduleStatus).not.toHaveBeenCalled();
  },
);
it.each(surfaces)('%s preserves unchecked state on required-value failure', async (surface) => {
  const missing = {
    ...schedule,
    tasks: schedule.tasks.map((task) => ({
      ...task,
      items: task.items.map((item) => ({ ...item, value_text: null, completed: false })),
    })),
  };
  vi.mocked(completeSchedule).mockRejectedValue(
    new ApiError('client.fillInAllRequiredFieldsBeforeCompleting', 409, 'REQUIREMENTS_INCOMPLETE'),
  );
  show(surface, missing);
  fireEvent.click(await control(surface));
  expect(await screen.findByRole('alert')).toHaveTextContent('필수 항목');
  const unchanged = await control(surface);
  if (surface !== 'today') expect(unchanged).not.toBeChecked();
  expect(updateScheduleStatus).not.toHaveBeenCalled();
});
it.each(surfaces)('%s locks cancelled schedules', async (surface) => {
  show(surface, { ...schedule, status: 'cancelled' });
  expect(await control(surface)).toBeDisabled();
  expect(completeSchedule).not.toHaveBeenCalled();
});
