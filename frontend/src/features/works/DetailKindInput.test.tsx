import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DetailKindInput } from './DetailKindInput';

it('toggles the field and arrow without focus reopening the list', () => {
  render(<DetailKindInput label="Kind" value="Address" names={['Address']} onChange={vi.fn()} />);
  const field = screen.getByRole('combobox');
  fireEvent.focus(field);
  fireEvent.click(field);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.click(field);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  const arrow = screen.getByRole('button');
  fireEvent.click(arrow);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.click(arrow);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('supports keyboard selection, manual typing and Escape dismissal', () => {
  const onChange = vi.fn();
  render(<DetailKindInput label="Kind" value="Address" names={['Address']} onChange={onChange} />);
  const field = screen.getByRole('combobox');
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('Address');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(field).not.toHaveAttribute('readonly');
  fireEvent.change(field, { target: { value: 'Custom' } });
  expect(onChange).toHaveBeenCalledWith('Custom');
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
