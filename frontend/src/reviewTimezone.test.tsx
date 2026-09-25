import { bootstrapSettings, defaultSettings } from './api/settings';
vi.mock('./api/settings', async (original) => ({
  ...(await original<typeof import('./api/settings')>()),
  bootstrapSettings: vi.fn(),
}));
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { dateInZone } from './features/schedules/timeRange';
vi.mock('./api/works', async (original) => ({
  ...(await original<typeof import('./api/works')>()),
  initializeLocalUser: vi.fn(),
}));
vi.mock('./api/schedules', async (original) => ({
  ...(await original<typeof import('./api/schedules')>()),
  getRangeSchedules: vi.fn().mockResolvedValue([]),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('REVIEW: calendar initially selects the saved-zone date', async () => {
  vi.useFakeTimers();
  const now = new Date(2026, 8, 24, 0, 30);
  vi.setSystemTime(now);
  const zone = 'Pacific/Honolulu';
  const expected = dateInZone(zone, now);
  vi.mocked(bootstrapSettings).mockResolvedValue({ ...defaultSettings, time_zone: zone });
  window.history.replaceState(null, '', '#/calendar');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  await act(async () => {
    render(<App />);
  });
  fireEvent.click(screen.getByRole('button', { current: 'date' }));
  expect(screen.getByRole('link', { name: '이 날짜에 스케줄 만들기' })).toHaveAttribute(
    'href',
    '#/schedules/new?date=' + expected,
  );
});
