import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { searchSchedules } from '../../api/schedules';
import { ScheduleSearchControl } from './ScheduleSearchControl';
vi.mock('../../api/schedules', () => ({ searchSchedules: vi.fn() }));
it('passes the page search draft to the search dialog and preserves it on close', async () => {
  vi.mocked(searchSchedules).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  render(<ScheduleSearchControl />);
  fireEvent.change(screen.getByRole('searchbox', { name: '일정 검색' }), {
    target: { value: '운동' },
  });
  fireEvent.submit(screen.getByRole('search'));
  expect(screen.getByRole('dialog', { name: '일정 검색' })).toBeVisible();
  expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveValue('운동');
  await waitFor(() =>
    expect(searchSchedules).toHaveBeenCalledWith('운동', 0, expect.any(AbortSignal)),
  );
  fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));
  expect(screen.getByRole('searchbox', { name: '일정 검색' })).toHaveValue('운동');
});
