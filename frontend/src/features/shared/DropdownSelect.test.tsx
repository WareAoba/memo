import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DropdownSelect } from './DropdownSelect';

const options = ['Asia/Seoul', 'Europe/Paris', 'Pacific/Honolulu'].map((value) => ({
  value,
  label: value,
}));
it('navigates and searches without saving until a choice is committed', () => {
  const onChange = vi.fn();
  render(<DropdownSelect label="Zone" value="Asia/Seoul" options={options} onChange={onChange} />);
  const select = screen.getByRole('combobox', { name: 'Zone' });
  select.focus();
  fireEvent.keyDown(select, { key: 'ArrowDown' });
  expect(select).toHaveAttribute(
    'aria-activedescendant',
    screen.getByRole('option', { name: 'Europe/Paris' }).id,
  );
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(select, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(select).toHaveFocus();
  fireEvent.keyDown(select, { key: 'p' });
  fireEvent.keyDown(select, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('Pacific/Honolulu');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(select);
  fireEvent.keyDown(select, { key: 'End' });
  fireEvent.keyDown(select, { key: 'Home' });
  expect(select).toHaveAttribute(
    'aria-activedescendant',
    screen.getByRole('option', { name: 'Asia/Seoul' }).id,
  );
  fireEvent.blur(select);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('selects by pointer, dismisses outside and respects disabled state', () => {
  const onChange = vi.fn();
  const view = render(
    <DropdownSelect label="Zone" value="Asia/Seoul" options={options} onChange={onChange} />,
  );
  const select = screen.getByRole('combobox');
  fireEvent.click(select);
  fireEvent.click(screen.getByRole('option', { name: 'Europe/Paris' }));
  expect(onChange).toHaveBeenCalledWith('Europe/Paris');
  fireEvent.click(select);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  view.rerender(
    <DropdownSelect
      label="Zone"
      value="Asia/Seoul"
      options={options}
      onChange={onChange}
      disabled
    />,
  );
  expect(select).toBeDisabled();
  fireEvent.click(select);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
