import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { suggestUnmanaged } from '../../api/unmanagedPresets';
import { UnmanagedSuggestions } from './UnmanagedSuggestions';

vi.mock('../../api/unmanagedPresets', () => ({ suggestUnmanaged: vi.fn() }));

it('debounces names, hides stale suggestions and explains promotion before saving', async () => {
  vi.mocked(suggestUnmanaged).mockResolvedValue([{ id: 'hidden', name: '운동' }]);
  const select = vi.fn();
  const { rerender } = render(<UnmanagedSuggestions kind="work" name="" onSelect={select} />);
  expect(suggestUnmanaged).not.toHaveBeenCalled();
  rerender(<UnmanagedSuggestions kind="work" name="운" onSelect={select} />);
  rerender(<UnmanagedSuggestions kind="work" name="운동" onSelect={select} />);
  fireEvent.click(await screen.findByRole('button', { name: '운동' }));
  expect(select).toHaveBeenCalledWith('운동');
  expect(screen.getByRole('status')).toHaveTextContent('기존 일정에도 이 상세정보를 적용');
  expect(suggestUnmanaged).toHaveBeenCalledTimes(1);
  const signal = vi.mocked(suggestUnmanaged).mock.calls[0]![2];
  rerender(<UnmanagedSuggestions kind="work" name="독서" onSelect={select} />);
  expect(screen.queryByRole('button', { name: '운동' })).not.toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(suggestUnmanaged).toHaveBeenCalledTimes(2));
});
