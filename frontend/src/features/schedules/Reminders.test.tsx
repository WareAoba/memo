import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getReminders, type Reminder } from '../../api/reminders';
import { Reminders } from './Reminders';
vi.mock('../../api/reminders');
const reminder: Reminder = {
  id: 'schedule-1',
  title: '영어 공부',
  start_time: '09:00',
  scheduled_date: '2026-09-25',
  time_zone: 'Asia/Tokyo',
  reminder_at: 100,
  start_at: 9999999999,
};
beforeEach(() => {
  localStorage.clear();
  vi.mocked(getReminders).mockResolvedValue([reminder]);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

it('opens the schedule, dismisses and does not repeat after remount', async () => {
  const first = render(<Reminders />);
  expect(await screen.findByText('영어 공부')).toBeVisible();
  expect(screen.getByRole('link', { name: /스케줄 보기/ })).toHaveAttribute(
    'href',
    '#/schedules/schedule-1',
  );
  fireEvent.click(screen.getByRole('button', { name: '영어 공부 알림 닫기' }));
  first.unmount();
  render(<Reminders />);
  await waitFor(() => expect(getReminders).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
});

it('polls, removes cancelled reminders and shows rescheduled occurrences', async () => {
  vi.useFakeTimers();
  vi.mocked(getReminders).mockResolvedValueOnce([]);
  render(<Reminders />);
  await act(async () => {});
  expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(screen.getByText('영어 공부')).toBeVisible();
  vi.mocked(getReminders).mockResolvedValueOnce([]);
  await act(async () => {
    window.dispatchEvent(new Event('schedules-changed'));
  });
  expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
  vi.mocked(getReminders).mockResolvedValue([{ ...reminder, reminder_at: 200 }]);
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(screen.getByText('영어 공부')).toBeVisible();
});

it('retries after a network failure', async () => {
  vi.mocked(getReminders).mockRejectedValueOnce(new Error('offline'));
  render(<Reminders />);
  await waitFor(() => expect(getReminders).toHaveBeenCalledTimes(1));
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  expect(await screen.findByText('영어 공부')).toBeVisible();
});

it('does not consume reminders while hidden and recovers without storage', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<Reminders />);
  expect(getReminders).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await screen.findByText('영어 공부')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '영어 공부 알림 닫기' }));
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
});
