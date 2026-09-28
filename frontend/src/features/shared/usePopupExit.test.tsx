import { useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePopupState } from './usePopupExit';
import { Button } from './ui';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen, toggle] = usePopupState(ref);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Button onClick={toggle}>Toggle</Button>
      <Button onClick={() => setOpen(false)}>Close</Button>
      {open && (
        <div ref={ref} role="dialog">
          Popup
        </div>
      )}
    </>
  );
}

function setup() {
  const view = render(<Harness />);
  fireEvent.click(screen.getByText('Open'));
  let finish!: () => void;
  const animation = {
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  };
  const animate = vi.fn(() => animation);
  Object.defineProperty(screen.getByRole('dialog'), 'animate', { value: animate });
  return { ...view, finish, animate, animation };
}

it('waits for exit, ignores repeated closes, and removes the popup after completion', async () => {
  const { finish, animate, animation } = setup();
  animation.cancel.mockImplementation(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Close'));
  fireEvent.click(screen.getByText('Close'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(animate).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('cancels a stale close on reopen and cleans up on unmount', async () => {
  const { finish, animation, unmount } = setup();
  fireEvent.click(screen.getByText('Close'));
  fireEvent.click(screen.getByText('Open'));
  await act(async () => finish());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(animation.cancel).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Close'));
  unmount();
  expect(animation.cancel).toHaveBeenCalledTimes(2);
});

it('reopens on a rapid trigger toggle while the closing popup is still mounted', async () => {
  const { finish, animation } = setup();
  fireEvent.click(screen.getByText('Toggle'));
  fireEvent.click(screen.getByText('Toggle'));
  await act(async () => finish());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(animation.cancel).toHaveBeenCalledTimes(1);
});

it.each(['none', 'reduced'])('closes immediately for %s motion', (motion) => {
  const { animate } = setup();
  document.documentElement.dataset.motion = motion;
  fireEvent.click(screen.getByText('Close'));
  expect(animate).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
