import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PresetModal } from './PresetModal';
import { Button } from './ui';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>열기</Button>
      {open && (
        <PresetModal label="편집" onClose={() => setOpen(false)}>
          내용
        </PresetModal>
      )}
    </>
  );
}
it('dismisses only for a primary press beginning on the backdrop', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '열기' }));
  const dialog = screen.getByRole('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 100,
    right: 500,
    bottom: 500,
  } as DOMRect);
  fireEvent.pointerDown(screen.getByText('내용'), { button: 0, clientX: 200, clientY: 200 });
  fireEvent.pointerUp(dialog, { button: 0, clientX: 600, clientY: 600 });
  fireEvent.click(dialog, { clientX: 600, clientY: 600 });
  expect(dialog).toBeInTheDocument();
  fireEvent(
    dialog,
    new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: 600, clientY: 600 }),
  );
  expect(dialog).toBeInTheDocument();
  fireEvent(
    dialog,
    new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 600, clientY: 600 }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps the dialog modal until its exit completes and restores focus once', async () => {
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: '열기' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  let finish!: () => void;
  const animation = {
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  };
  const animate = vi.fn(() => animation);
  Object.defineProperty(dialog, 'animate', { value: animate });
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(animate).toHaveBeenCalledTimes(1);
  expect(dialog).toHaveAttribute('open');
  await act(async () => finish());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it.each(['none', 'reduced'])('closes immediately with %s motion', (motion) => {
  document.documentElement.dataset.motion = motion;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '열기' }));
  const animate = vi.fn();
  Object.defineProperty(screen.getByRole('dialog'), 'animate', { value: animate });
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  expect(animate).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('holds the transparent exit state until its owner unmounts and uses the latest callback', async () => {
  const onClose = vi.fn();
  const latestClose = vi.fn();
  const { rerender } = render(
    <PresetModal label="편집" onClose={onClose}>
      내용
    </PresetModal>,
  );
  const dialog = screen.getByRole('dialog');
  let finish!: () => void;
  const animate = vi.fn(() => ({
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  }));
  Object.defineProperty(dialog, 'animate', { value: animate });
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  rerender(
    <PresetModal label="편집" onClose={latestClose}>
      내용
    </PresetModal>,
  );
  await act(async () => finish());
  expect(dialog).toHaveAttribute('data-closing', 'true');
  expect(onClose).not.toHaveBeenCalled();
  expect(latestClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  expect(animate).toHaveBeenCalledTimes(1);
});
