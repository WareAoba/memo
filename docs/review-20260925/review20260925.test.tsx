// Copy to frontend/src/review20260925.test.tsx to run these review reproductions.
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { TaskExecution } from './features/schedules/TaskExecution';
import { ScheduleView } from './features/schedules/Schedules';
import { emptyFields } from './api/entities';
import { getSchedule, getDaySchedules, updateTask, type ScheduleDetail } from './api/schedules';

const clock = vi.hoisted(() => ({ today: '2026-09-24' }));
vi.mock('./features/workspace/useToday', () => ({ useToday: () => clock.today }));
vi.mock('./features/schedules/Photos', () => ({ Photos: () => null }));
vi.mock('./api/schedules');
vi.mock('./api/entities', async (original) => ({
  ...(await original<typeof import('./api/entities')>()),
  initializeLocalUser: vi.fn(async () => 'Asia/Tokyo'),
}));
afterEach(() => { vi.resetAllMocks(); clock.today = '2026-09-24'; });

const schedule: ScheduleDetail = {
  id: 's', entity_id: 'e', title: 'Work', scheduled_date: '2026-09-24',
  end_date: '2026-09-25', start_time: '09:00', end_time: '10:00', time_zone: 'Asia/Tokyo',
  notes: '', archived: false, status: 'planned', created_at: '', updated_at: '',
  entity_snapshot: { ...emptyFields, name: 'Work', custom_fields: [{ name: '출입 안내', value: '후문으로 입장' }] },
  tasks: [{ id: 't', name_snapshot: 'Task', execution_notes: '', default_notes_snapshot: '',
    source_task_preset_version: 1, status: 'pending', items: [] }],
};

it('review: successful trimmed rename should allow completion', async () => {
  vi.mocked(updateTask).mockResolvedValue({ ...schedule, tasks: [{ ...schedule.tasks[0]!, name_snapshot: 'Renamed' }] });
  function Harness() {
    const [value, setValue] = useState(schedule);
    return <TaskExecution task={value.tasks[0]!} allowRename locked={false} busy={false}
      mutate={async (op) => { setValue(await op()); }} />;
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('태스크 이름'), { target: { value: ' Renamed ' } });
  fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
  await screen.findByText('저장했습니다.');
  expect(updateTask).toHaveBeenCalledWith('t', { name: 'Renamed' });
  expect(screen.getByRole('button', { name: '태스크 완료' })).toBeEnabled();
});

it('review: schedule detail should expose saved custom information', async () => {
  vi.mocked(getSchedule).mockResolvedValue(schedule);
  render(<ScheduleView id="s" edit={false} />);
  await screen.findByRole('heading', { name: 'Work', level: 1 });
  expect(screen.queryByText('후문으로 입장')).toBeInTheDocument();
});

it('review: automatic day rollover should preserve an open execution draft', async () => {
  window.history.replaceState(null, '', '#/today');
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  const view = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Task 수정' }));
  fireEvent.change(screen.getByLabelText('실행 메모'), { target: { value: 'unfinished draft' } });
  clock.today = '2026-09-25';
  view.rerender(<App />);
  await screen.findByRole('button', { name: 'Task 수정' });
  expect(screen.queryByDisplayValue('unfinished draft')).toBeInTheDocument();
});
