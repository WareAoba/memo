import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

it('opens settings from the account and dismisses with Escape or an outside click', () => {
  const onSettings = vi.fn();
  render(
    <AccountMenu
      account={{ id: 'owner', display_name: '민수', email: 'min@example.com' }}
      onSettings={onSettings}
    />,
  );
  const trigger = screen.getByRole('button', { name: '민수' });
  expect(screen.queryByRole('button', { name: '설정' })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByText('min@example.com')).toBeVisible();
  fireEvent.keyDown(screen.getByRole('button', { name: '설정' }), { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.click(document.body);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '설정' }));
  expect(onSettings).toHaveBeenCalledOnce();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('falls back to an initial when a profile image fails', () => {
  const { container } = render(
    <AccountMenu
      account={{
        id: 'owner',
        display_name: '민수',
        email: null,
        picture: 'https://example.com/avatar.png',
      }}
      onSettings={() => {}}
    />,
  );
  const image = container.querySelector('img')!;
  expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  fireEvent.error(image);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('민')).toBeVisible();
});
