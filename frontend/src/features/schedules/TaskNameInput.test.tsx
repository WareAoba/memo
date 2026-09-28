import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { listTaskPresets } from '../../api/taskPresets';
import { TaskNameInput } from './TaskNameInput';

vi.mock('../../api/taskPresets');
afterEach(() => vi.resetAllMocks());

it('keeps long-list keyboard targets visible without committing while navigating', async () => {
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `Task ${index}` })),
    total: 20,
    offset: 0,
    limit: 20,
  } as Awaited<ReturnType<typeof listTaskPresets>>);
  const commit = vi.fn();
  render(<TaskNameInput value="Task" onChange={vi.fn()} onCommit={commit} />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  const menu = await screen.findByRole('listbox');
  expect(menu).toHaveAttribute('popover', 'manual');
  expect(menu).toHaveStyle({ position: 'fixed' });
  const last = screen.getByRole('option', { name: 'Task 19' });
  const scroll = vi.fn();
  last.scrollIntoView = scroll;
  for (let index = 0; index < 20; index++) fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input).toHaveAttribute('aria-activedescendant', last.id);
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
  expect(commit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveValue('Task');
  expect(commit).not.toHaveBeenCalled();
});
