import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NewTaskRows, SavedTaskRow } from './ScheduleTaskRows';
import {
  addScheduleTask,
  updateTask,
  type ScheduleDetail,
  type ScheduleTask,
} from '../../api/schedules';
import { listTaskPresets } from '../../api/taskPresets';
vi.mock('../../api/schedules');
vi.mock('../../api/taskPresets');
const result = {} as ScheduleDetail;
const mutate = async (operation: () => Promise<ScheduleDetail>) => {
  await operation();
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
});
it('adds selected tasks serially and retains failed and parameterized drafts', async () => {
  const items = ['A', 'B', '입력 [n]'].map((name, index) => ({
    id: String(index),
    name,
    group_name: '그룹',
    default_notes: '',
    tags: [],
    archived: false,
    version: 1,
    created_at: '',
    updated_at: '',
    item_count: 0,
  }));
  vi.mocked(listTaskPresets).mockResolvedValue({ items, total: 3, offset: 0, limit: 100 });
  vi.mocked(addScheduleTask)
    .mockResolvedValueOnce(result)
    .mockRejectedValueOnce(new Error('두 번째 실패'));
  render(<NewTaskRows scheduleId="s" disabled={false} mutate={mutate} />);
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.click(screen.getByRole('button', { name: '태스크 목록' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'A' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '입력 [n]' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 태스크 추가 (3)' }));
  await screen.findByText('두 번째 실패');
  expect(addScheduleTask).toHaveBeenCalledTimes(2);
  expect(addScheduleTask).toHaveBeenNthCalledWith(1, 's', '0', { parameters: {} });
  expect(screen.getAllByRole('combobox').map((input) => (input as HTMLInputElement).value)).toEqual(
    ['', 'B', '입력 [n]'],
  );
  expect(screen.getByLabelText('n')).toHaveValue('');
});
it('starts with an add action, keeps independent rows, and retains a failed task draft', async () => {
  vi.mocked(addScheduleTask)
    .mockRejectedValueOnce(new Error('추가 실패'))
    .mockResolvedValue(result);
  render(<NewTaskRows scheduleId="s" disabled={false} mutate={mutate} />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
  const input = screen.getAllByRole('combobox')[0]!;
  fireEvent.change(input, { target: { value: '새 태스크' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(await screen.findByText('추가 실패')).toBeVisible();
  expect(input).toHaveValue('새 태스크');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(1));
  expect(addScheduleTask).toHaveBeenLastCalledWith('s', 'name:새 태스크');
});
it('renames only the schedule task, retains failure drafts, and updates completion', async () => {
  const task: ScheduleTask = {
    id: 't',
    name_snapshot: 'Original',
    status: 'pending',
    items: [],
    execution_notes: '',
    default_notes_snapshot: '',
    source_task_preset_version: 1,
  };
  vi.mocked(updateTask).mockRejectedValueOnce(new Error('수정 실패')).mockResolvedValue(result);
  render(<SavedTaskRow task={task} disabled={false} mutate={mutate} onEdit={vi.fn()} />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Changed' } });
  fireEvent.blur(input);
  expect(await screen.findByText('수정 실패')).toBeVisible();
  expect(input).toHaveValue('Changed');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(2));
  expect(updateTask).toHaveBeenLastCalledWith('t', { name: 'Changed', parameters: {} });
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(updateTask).toHaveBeenLastCalledWith('t', { status: 'completed' }));
});
