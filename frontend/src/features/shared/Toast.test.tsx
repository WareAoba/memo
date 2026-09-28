import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

afterEach(() => {
  delete document.documentElement.dataset.motion;
});
function Harness() {
  const [visible, setVisible] = useState(true);
  return (
    visible && (
      <Toast title="Test" onClose={() => setVisible(false)}>
        Body
      </Toast>
    )
  );
}
it('keeps the toast mounted through downward exit and ignores repeated closes', async () => {
  const { container } = render(<Harness />);
  const article = container.querySelector('article')!;
  article.style.setProperty('--popup-exit-transform', 'translateY(80px)');
  let finish!: () => void;
  const animate = vi.fn(() => ({
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  }));
  Object.defineProperty(article, 'animate', { value: animate });
  fireEvent.click(screen.getByRole('button', { name: 'Test 알림 닫기' }));
  fireEvent.click(screen.getByRole('button', { name: 'Test 알림 닫기' }));
  expect(screen.getByText('Test')).toBeInTheDocument();
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate).toHaveBeenCalledWith(
    expect.arrayContaining([{ opacity: 0, transform: 'translateY(80px)' }]),
    expect.objectContaining({ fill: 'forwards' }),
  );
  await act(async () => finish());
  expect(screen.queryByText('Test')).not.toBeInTheDocument();
});
it.each(['none', 'reduced'])('dismisses immediately for %s motion', (motion) => {
  document.documentElement.dataset.motion = motion;
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Test 알림 닫기' }));
  expect(screen.queryByText('Test')).not.toBeInTheDocument();
});
