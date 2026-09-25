import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeleteButton, SwipeDelete } from './SwipeDelete';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('reveals only the swiped row and never deletes on the gesture itself', async () => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerType = 'touch';
      pointerId = 1;
    },
  );
  const remove = vi.fn().mockResolvedValue(undefined);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <SwipeDelete label="스케줄" onDelete={remove}>
      <SwipeDelete label="태스크" onDelete={remove}>
        <span>태스크 행</span>
      </SwipeDelete>
    </SwipeDelete>,
  );
  const row = screen.getByText('태스크 행');
  fireEvent.pointerDown(row, { clientX: 200, clientY: 40 });
  fireEvent.pointerUp(row, { clientX: 190, clientY: 200 });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  fireEvent.pointerDown(row, { clientX: 200, clientY: 40 });
  fireEvent.pointerUp(row, { clientX: 80, clientY: 42 });
  fireEvent.click(row);
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '스케줄 삭제' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 삭제' }));
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  expect(confirm).toHaveBeenCalledTimes(1);
});
it('cancels deletion and keeps a failed deletion retryable', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const remove = vi.fn().mockRejectedValueOnce(new Error('삭제 실패')).mockResolvedValue(undefined);
  render(<DeleteButton label="일정" onDelete={remove} />);
  fireEvent.click(screen.getByRole('button', { name: '일정 삭제' }));
  expect(remove).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '일정 삭제' }));
  expect(await screen.findByText('삭제 실패')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '일정 삭제' }));
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
});
