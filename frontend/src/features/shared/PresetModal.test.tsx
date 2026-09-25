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
