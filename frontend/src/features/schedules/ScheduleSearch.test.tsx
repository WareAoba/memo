import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { searchSchedules } from '../../api/schedules';
import { ScheduleSearch } from './ScheduleSearch';

vi.mock('../../api/schedules');
afterEach(() => vi.resetAllMocks());
const row = {
  id: 's',
  entity_id: 'w',
  title: '워크',
  scheduled_date: '2026-09-25',
  end_date: '2026-09-25',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'planned',
  created_at: '',
  updated_at: '',
};
it('paginates, resets on search changes, and retries failed searches', async () => {
  vi.mocked(searchSchedules).mockResolvedValue({
    items: Array.from({ length: 20 }, (_, i) => ({ ...row, id: String(i) })),
    total: 21,
    limit: 20,
    offset: 0,
  });
  render(<ScheduleSearch onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '다음 결과' }));
  await waitFor(() =>
    expect(searchSchedules).toHaveBeenLastCalledWith('', 20, expect.any(AbortSignal)),
  );
  vi.mocked(searchSchedules).mockRejectedValueOnce(new Error('검색 실패'));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '메모' } });
  expect(await screen.findByText('검색 실패')).toBeVisible();
  expect(searchSchedules).toHaveBeenLastCalledWith('메모', 0, expect.any(AbortSignal));
  vi.mocked(searchSchedules).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('검색 결과가 없습니다.')).toBeVisible();
  expect(screen.queryByLabelText('검색 범위')).not.toBeInTheDocument();
});
it('does not show a stale response after the query changes', async () => {
  let resolveOld!: (value: Awaited<ReturnType<typeof searchSchedules>>) => void;
  vi.mocked(searchSchedules)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
  render(<ScheduleSearch onClose={() => {}} />);
  await waitFor(() => expect(searchSchedules).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(searchSchedules).mock.calls[0]![2]!;
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '다른 검색' } });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolveOld({ items: [row], total: 1, offset: 0, limit: 20 });
  });
  expect(await screen.findByText('검색 결과가 없습니다.')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
