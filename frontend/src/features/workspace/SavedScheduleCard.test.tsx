import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { emptyFields } from '../../api/works';
import { updateTask, type ScheduleDetail } from '../../api/schedules';
import { SavedScheduleCard } from './SavedScheduleCard';

vi.mock('../../api/schedules');
const schedule: ScheduleDetail = {
  id: 'schedule',
  entity_id: 'work',
  title: '점검',
  scheduled_date: '2026-09-26',
  end_date: '2026-09-26',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'planned',
  created_at: '',
  updated_at: '',
  entity_snapshot: { ...emptyFields, name: '점검' },
  tasks: [
    {
      id: 'task',
      status: 'pending',
      execution_notes: '',
      name_snapshot: '화면 확인',
      default_notes_snapshot: '',
      source_task_preset_version: 1,
      items: [],
    },
  ],
};
it('opens the selected execution directly and retains a failed rename until retry succeeds', async () => {
  const updated = { ...schedule, tasks: [{ ...schedule.tasks[0]!, name_snapshot: '모바일 확인' }] };
  vi.mocked(updateTask)
    .mockRejectedValueOnce(new Error('연결 실패'))
    .mockResolvedValueOnce(updated);
  function Harness() {
    const [value, setValue] = useState(schedule);
    return <SavedScheduleCard value={value} onChange={setValue} />;
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: '화면 확인' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = within(screen.getByRole('dialog', { name: '화면 확인 수정' }));
  expect(screen.queryByRole('dialog', { name: '스케줄 수정' })).not.toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText('태스크 이름'), { target: { value: '모바일 확인' } });
  fireEvent.click(dialog.getByRole('button', { name: '이름 저장' }));
  expect(await dialog.findByText('연결 실패')).toBeVisible();
  expect(dialog.getByLabelText('태스크 이름')).toHaveValue('모바일 확인');
  fireEvent.click(dialog.getByRole('button', { name: '이름 저장' }));
  await waitFor(() => expect(updateTask).toHaveBeenLastCalledWith('task', { name: '모바일 확인' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.queryByText(/^(메모를 저장했습니다\.|저장했습니다\.|자동 저장)$/),
  ).not.toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: '상세 닫기' }));
  expect(screen.getByRole('button', { name: '모바일 확인' })).toHaveFocus();
});

it('previews schedule notes without line breaks and keeps the time in the heading', () => {
  const { container, rerender } = render(
    <SavedScheduleCard value={{ ...schedule, notes: '  첫 줄\n\n  다음 줄 ' }} />,
  );
  expect(container.querySelector('.schedule-card-memo')?.textContent).toBe('첫 줄 다음 줄');
  expect(screen.getByRole('heading', { name: /점검/ })).toHaveTextContent('09:00 — 10:00');
  rerender(<SavedScheduleCard value={{ ...schedule, notes: ' \n ' }} />);
  expect(container.querySelector('.schedule-card-memo')).toBeNull();
});
