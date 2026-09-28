import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReminderSettings } from './ReminderSettings';

it.each([
  ['minutes', 10080],
  ['hours', 168],
  ['days', 7],
] as const)('limits %s to seven days and removes weeks', (unit, max) => {
  render(
    <ReminderSettings
      value={{ reminder_enabled: true, reminder_value: max, reminder_unit: unit }}
      onChange={vi.fn()}
    />,
  );
  const amount = screen.getByRole('spinbutton') as HTMLInputElement;
  expect(amount).toHaveAttribute('max', String(max));
  expect(amount.checkValidity()).toBe(true);
  fireEvent.change(amount, { target: { value: max + 1 } });
  // A controlled form keeps its value until its owner accepts the change.
  expect(screen.getByText(/최대 7일/)).toBeVisible();
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('option', { name: '주' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

it('marks an existing over-limit amount invalid', () => {
  render(
    <ReminderSettings
      value={{ reminder_enabled: true, reminder_value: 8, reminder_unit: 'days' }}
      onChange={vi.fn()}
    />,
  );
  expect((screen.getByRole('spinbutton') as HTMLInputElement).checkValidity()).toBe(false);
});
