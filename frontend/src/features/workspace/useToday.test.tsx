import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useToday } from './useToday';
afterEach(() => vi.useRealTimers());
it('rolls over at local midnight including month and year boundaries', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
  const { result, unmount } = renderHook(useToday);
  expect(result.current).toBe('2026-12-31');
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current).toBe('2027-01-01');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(['focus', 'pageshow', 'visibilitychange'])('refreshes on %s after sleep', (event) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 24, 12));
  const { result } = renderHook(useToday);
  vi.setSystemTime(new Date(2026, 8, 26, 12));
  act(() => (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event)));
  expect(result.current).toBe('2026-09-26');
});
