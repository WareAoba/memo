import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { publishScheduleChange } from '../../api/scheduleChanges';
import { beforeEach, expect, it, vi } from 'vitest';
import { StickySchedules } from './StickySchedules';
import {
  completeSchedule,
  getDaySchedules,
  getSchedule,
  updateTask,
  type ScheduleDetail,
} from '../../api/schedules';
import { emptyFields } from '../../api/works';
vi.mock('../../api/schedules');
const value: ScheduleDetail = {
  id: 's',
  entity_id: null,
  title: '스케줄',
  scheduled_date: '2026-09-27',
  end_date: '2026-09-27',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'planned',
  created_at: '',
  updated_at: '',
  entity_snapshot: emptyFields,
  tasks: [
    {
      id: 't',
      status: 'pending',
      execution_notes: '',
      name_snapshot: '태스크',
      default_notes_snapshot: '',
      source_task_preset_version: 1,
      items: [],
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDaySchedules).mockResolvedValue([value]);
  vi.mocked(getSchedule).mockResolvedValue(value);
});
it('completes tasks and whole schedules using the existing execution API', async () => {
  vi.mocked(updateTask).mockResolvedValue({
    ...value,
    tasks: [{ ...value.tasks[0]!, status: 'completed' }],
  });
  vi.mocked(completeSchedule).mockResolvedValue({
    ...value,
    status: 'completed',
    tasks: [{ ...value.tasks[0]!, status: 'completed' }],
  });
  render(<StickySchedules kind="date" target="2026-09-27" />);
  fireEvent.click(await screen.findByRole('checkbox', { name: '태스크 완료 전환' }));
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: '태스크 완료 전환' })).toBeChecked(),
  );
  expect(updateTask).toHaveBeenCalledWith('t', { status: 'completed' });
  fireEvent.click(screen.getByRole('checkbox', { name: '스케줄 완료 전환' }));
  await waitFor(() =>
    expect(screen.getByRole('checkbox', { name: '스케줄 완료 전환' })).toBeChecked(),
  );
  expect(completeSchedule).toHaveBeenCalledWith('s');
});
it('preserves unchecked state and offers schedule editing after a failed completion', async () => {
  vi.mocked(updateTask).mockRejectedValue(new Error('필수 입력을 확인하세요'));
  render(<StickySchedules kind="schedule" target="s" />);
  fireEvent.click(await screen.findByRole('checkbox', { name: '태스크 완료 전환' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('필수 입력을 확인하세요');
  expect(screen.getByRole('checkbox', { name: '태스크 완료 전환' })).not.toBeChecked();
  expect(screen.getByRole('link', { name: '스케줄' })).toHaveAttribute('href', '#/schedules/s');
});

it('applies returned details, date moves and deletes without querying each open sticker again', async () => {
  render(
    <>
      <StickySchedules kind="date" target="2026-09-27" />
      <StickySchedules kind="schedule" target="s" />
    </>,
  );
  await waitFor(() => expect(screen.getAllByRole('link', { name: '스케줄' })).toHaveLength(2));
  act(() =>
    publishScheduleChange({
      kind: 'saved',
      id: 's',
      schedule: { ...value, title: '바뀐 이름', color: 'red' },
    }),
  );
  expect(screen.getAllByRole('link', { name: '바뀐 이름' })).toHaveLength(2);
  act(() =>
    publishScheduleChange({
      kind: 'saved',
      id: 's',
      schedule: { ...value, scheduled_date: '2026-09-28', end_date: '2026-09-28' },
    }),
  );
  expect(screen.getAllByRole('link', { name: '스케줄' })).toHaveLength(1);
  act(() => publishScheduleChange({ kind: 'deleted', id: 's' }));
  expect(screen.queryByRole('link', { name: '스케줄' })).not.toBeInTheDocument();
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
  expect(getSchedule).toHaveBeenCalledTimes(1);
});

it('ignores unrelated schedule writes and refetches broad preset/reset changes', async () => {
  render(<StickySchedules kind="schedule" target="s" />);
  await screen.findByRole('link', { name: '스케줄' });
  act(() =>
    publishScheduleChange({ kind: 'saved', id: 'other', schedule: { ...value, id: 'other' } }),
  );
  expect(getSchedule).toHaveBeenCalledTimes(1);
  act(() => publishScheduleChange({ kind: 'presets' }));
  await waitFor(() => expect(getSchedule).toHaveBeenCalledTimes(2));
  act(() => publishScheduleChange({ kind: 'reset' }));
  await waitFor(() => expect(getSchedule).toHaveBeenCalledTimes(3));
});

it('does not let an old initial read overwrite a write-triggered refresh', async () => {
  let resolve!: (schedule: ScheduleDetail) => void;
  vi.mocked(getSchedule)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ ...value, title: '최신' });
  render(<StickySchedules kind="schedule" target="s" />);
  act(() =>
    publishScheduleChange({ kind: 'saved', id: 's', schedule: { ...value, title: '최신' } }),
  );
  await screen.findByRole('link', { name: '최신' });
  await act(async () => resolve(value));
  expect(screen.queryByRole('link', { name: '스케줄' })).not.toBeInTheDocument();
});
