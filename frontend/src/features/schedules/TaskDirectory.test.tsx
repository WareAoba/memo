import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { listTaskPresets, type TaskPresetSummary } from '../../api/taskPresets';
import { TaskDirectory } from './TaskDirectory';
vi.mock('../../api/taskPresets');
const preset = (id: string, group_name: string): TaskPresetSummary => ({
  id,
  name: id,
  group_name,
  default_notes: '',
  tags: [],
  archived: false,
  version: 1,
  created_at: '',
  updated_at: '',
  item_count: 0,
});
beforeEach(() => vi.resetAllMocks());

it('loads every page, groups tasks, preserves selection order and excludes existing tasks', async () => {
  vi.mocked(listTaskPresets)
    .mockResolvedValueOnce({
      items: [preset('A', '공부'), preset('B', '공부')],
      total: 3,
      offset: 0,
      limit: 2,
    })
    .mockResolvedValueOnce({ items: [preset('C', '운동')], total: 3, offset: 2, limit: 2 });
  const add = vi.fn();
  const close = vi.fn();
  render(
    <TaskDirectory existing={[{ id: 'A', name: 'A' }]} capacity={2} onAdd={add} onClose={close} />,
  );
  expect(await screen.findByRole('checkbox', { name: 'A' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'C' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
  expect(add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '선택한 태스크 추가 (2)' }));
  expect(add.mock.calls[0]![0].map((item: TaskPresetSummary) => item.id)).toEqual(['C', 'B']);
  expect(close).toHaveBeenCalledOnce();
  expect(listTaskPresets).toHaveBeenNthCalledWith(2, '', false, 2, expect.any(AbortSignal), 100);
});

it('keeps selection within capacity and cancellation does not add tasks', async () => {
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [preset('A', ''), preset('B', '')],
    total: 2,
    offset: 0,
    limit: 100,
  });
  const add = vi.fn();
  render(<TaskDirectory existing={[]} capacity={1} onAdd={add} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'A' }));
  expect(screen.getByRole('checkbox', { name: 'B' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  expect(add).not.toHaveBeenCalled();
});

it('retries failed catalog loading without presenting a partial selection', async () => {
  vi.mocked(listTaskPresets)
    .mockRejectedValueOnce(new Error('목록 실패'))
    .mockResolvedValueOnce({ items: [preset('A', '')], total: 1, offset: 0, limit: 100 });
  render(<TaskDirectory existing={[]} capacity={100} onAdd={vi.fn()} onClose={vi.fn()} />);
  await screen.findByText('목록 실패');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'A' })).toBeEnabled());
});
