import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkTasks } from './WorkTasks';
import { getWorkTasks, saveWorkTasks } from '../../api/workTasks';
import { listTaskPresets } from '../../api/taskPresets';
vi.mock('../../api/workTasks');
vi.mock('../../api/taskPresets');
afterEach(() => vi.resetAllMocks());
it('search retry preserves unsaved connection edits', async () => {
  vi.mocked(getWorkTasks).mockResolvedValue([{ id: 'a', name: 'A', archived: false, position: 0 }]);
  vi.mocked(listTaskPresets)
    .mockRejectedValueOnce(new Error('검색 실패'))
    .mockResolvedValueOnce({ items: [], total: 0, offset: 0, limit: 20 });
  render(<WorkTasks id="work" />);
  fireEvent.click(await screen.findByRole('button', { name: 'A 연결 제거' }));
  expect(await screen.findByText('검색 실패')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(
    await screen.findByText(
      '검색된 태스크가 없습니다. 프리셋 설정의 태스크 탭에서 등록할 수 있습니다.',
    ),
  ).toBeVisible();
  expect(getWorkTasks).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('link', { name: 'A' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '기본 태스크 저장' })).toBeEnabled();
});
it('adds, reorders, preserves failed edits, saves and cancels changes', async () => {
  const a = { id: 'a', name: 'A', archived: true, position: 0 };
  const b = { id: 'b', name: 'B', archived: false, position: 1 };
  vi.mocked(getWorkTasks).mockResolvedValue([a]);
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [
      {
        ...b,
        default_notes: '',
        tags: [],
        version: 1,
        created_at: '',
        updated_at: '',
        item_count: 0,
      },
    ],
    total: 1,
    offset: 0,
    limit: 20,
  });
  vi.mocked(saveWorkTasks)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce([
      { ...b, position: 0 },
      { ...a, position: 1 },
    ]);
  render(<WorkTasks id="work" />);
  expect(await screen.findByText('보관됨 · 일정 선택 제외')).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: '추가' }));
  fireEvent.click(screen.getByRole('button', { name: 'B 위로' }));
  fireEvent.click(screen.getByRole('button', { name: '기본 태스크 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(
    within(screen.getAllByRole('list')[0]!)
      .getAllByRole('link')
      .map((x) => x.textContent),
  ).toEqual(['B', 'A']);
  fireEvent.click(screen.getByRole('button', { name: '기본 태스크 저장' }));
  await waitFor(() => expect(saveWorkTasks).toHaveBeenLastCalledWith('work', ['b', 'a']));
  expect(await screen.findByText('기본 태스크를 저장했습니다.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'A 연결 제거' }));
  fireEvent.click(screen.getByRole('button', { name: '변경 취소' }));
  expect(screen.getByRole('link', { name: 'A' })).toBeVisible();
  expect(screen.getByRole('button', { name: '기본 태스크 저장' })).toBeDisabled();
});
it('retries failed initial load without enabling an empty overwrite', async () => {
  vi.mocked(getWorkTasks).mockRejectedValueOnce(new Error('연결 실패')).mockResolvedValueOnce([]);
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
  render(<WorkTasks id="work" />);
  expect(await screen.findByText('연결 실패')).toBeVisible();
  expect(screen.queryByRole('button', { name: '기본 태스크 저장' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('연결된 기본 태스크가 없습니다.')).toBeVisible();
});
