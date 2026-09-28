import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getReminders, type Reminder } from '../../api/reminders';
import { Reminders } from './Reminders';
vi.mock('../../api/reminders', async (original) => ({
  ...(await original<typeof import('../../api/reminders')>()),
  getReminders: vi.fn(),
}));
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

it('keeps dismissed notifications in the menu and acknowledges one or all persistently', async () => {
  vi.mocked(getReminders).mockResolvedValue([
    reminder,
    { ...reminder, id: 'two', title: '두 번째' },
  ]);
  const view = render(<Reminders accountId="owner" />);
  await screen.findByText('영어 공부');
  fireEvent.click(screen.getByRole('button', { name: '영어 공부 알림 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: '알림 모아보기 (2개)' }));
  const menu = screen.getByRole('dialog', { name: '알림' });
  expect(within(menu).getByText('영어 공부')).toBeVisible();
  fireEvent.click(within(menu).getByRole('button', { name: '영어 공부 알림 확인' }));
  await waitFor(() => expect(within(menu).queryByText('영어 공부')).not.toBeInTheDocument());
  fireEvent.click(within(menu).getByRole('button', { name: '모두 확인' }));
  await screen.findByText('확인할 알림이 없어요.');
  view.unmount();
  render(<Reminders accountId="owner" />);
  fireEvent.click(screen.getByRole('button', { name: '알림 모아보기 (0개)' }));
  expect(screen.getByText('확인할 알림이 없어요.')).toBeVisible();
});

it.each([5, 10, 30, 60, 180])(
  'snoozes for %i minutes across remount and replays only once',
  async (minutes) => {
    vi.useFakeTimers();
    const view = render(<Reminders accountId="owner" />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('combobox', { name: '다시 알림' }));
    fireEvent.click(
      screen.getByRole('option', {
        name: minutes < 60 ? `${minutes}분 뒤` : `${minutes / 60}시간 뒤`,
      }),
    );
    await act(async () => {});
    expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
    view.unmount();
    render(<Reminders accountId="owner" />);
    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(minutes * 60000 - 15000);
    });
    expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(screen.getByText('영어 공부')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '영어 공부 알림 닫기' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(screen.queryByText('영어 공부')).not.toBeInTheDocument();
  },
);

it('restores only the current account history even when offline', async () => {
  const first = render(<Reminders accountId="first" />);
  await screen.findByText('영어 공부');
  first.unmount();
  vi.mocked(getReminders).mockResolvedValue([]);
  const second = render(<Reminders accountId="second" />);
  fireEvent.click(screen.getByRole('button', { name: '알림 모아보기 (0개)' }));
  expect(screen.getByText('확인할 알림이 없어요.')).toBeVisible();
  second.unmount();
  vi.mocked(getReminders).mockRejectedValue(new Error('offline'));
  render(<Reminders accountId="first" />);
  fireEvent.click(screen.getByRole('button', { name: '알림 모아보기 (1개)' }));
  expect(screen.getByText('영어 공부')).toBeVisible();
});

it('closes the notification dropdown with Escape and restores trigger focus', async () => {
  render(<Reminders />);
  await screen.findByText('영어 공부');
  const trigger = screen.getByRole('button', { name: '알림 모아보기 (1개)' });
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('dialog', { name: '알림' }), { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: '알림' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('keeps a snooze in memory when writes fail but older storage is still readable', async () => {
  vi.useFakeTimers();
  render(<Reminders />);
  await act(async () => {});
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  fireEvent.click(screen.getByRole('combobox', { name: '다시 알림' }));
  fireEvent.click(screen.getByRole('option', { name: '5분 뒤' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300000);
  });
  expect(screen.getByText('영어 공부')).toBeVisible();
});
