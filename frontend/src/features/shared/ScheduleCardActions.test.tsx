import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScheduleCardActions } from './ScheduleCardActions';
afterEach(() => vi.unstubAllGlobals());

it('groups memo and schedule edit controls inside a card without triggering completion', () => {
  const card = vi.fn();
  render(
    <article onClick={card}>
      <ScheduleCardActions id="s" label="워크" value="" onSave={vi.fn()} />
    </article>,
  );
  const edit = screen.getByRole('link', { name: '스케줄 수정' });
  expect(edit).toHaveAttribute('href', '#/schedules/s/edit');
  fireEvent.click(edit);
  expect(card).not.toHaveBeenCalled();
});
it('renders neither memo nor schedule edit shortcuts on mobile', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(<ScheduleCardActions id="s" label="워크" value="기존 메모" onSave={vi.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
