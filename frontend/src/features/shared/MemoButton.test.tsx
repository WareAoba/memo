import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoButton } from './MemoButton';

it('flushes on close, keeps a failed draft open, and retries without a save button', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('연결 실패')).mockResolvedValue(undefined);
  const outside = vi.fn();
  render(
    <>
      <button onClick={outside}>다른 동작</button>
      <MemoButton label="워크" value="" onSave={save} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: '워크 메모' }));
  fireEvent.change(screen.getByLabelText('메모'), { target: { value: '기록' } });
  expect(screen.queryByRole('button', { name: '메모 저장' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('다른 동작'));
  expect(outside).not.toHaveBeenCalled();
  expect(await screen.findByText('연결 실패')).toBeVisible();
  expect(screen.getByLabelText('메모')).toHaveValue('기록');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('메모를 저장했습니다.');
  fireEvent.keyDown(screen.getByLabelText('메모'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(save).toHaveBeenLastCalledWith('기록');
});

it('removes the trigger and overlay on mobile, flushing pending input and releasing the lock', async () => {
  let mobile = false;
  let change = () => {};
  vi.stubGlobal('matchMedia', () => ({
    matches: mobile,
    addEventListener: (_: string, callback: () => void) => {
      change = callback;
    },
    removeEventListener: vi.fn(),
  }));
  try {
    const save = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<MemoButton label="워크" value="" onSave={save} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: '워크 메모' }));
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '화면 변경 전 기록' } });
    act(() => {
      mobile = true;
      change();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '워크 메모' })).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(save).toHaveBeenCalledWith('화면 변경 전 기록'));
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps its parent dialog open on Escape and never submits a surrounding form', async () => {
  const submit = vi.fn();
  const key = vi.fn();
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <dialog open aria-label="상세" onKeyDown={key}>
      <form onSubmit={submit}>
        <MemoButton label="워크" value="기존" onSave={save} />
      </form>
    </dialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: '워크 메모' }));
  expect(screen.getByRole('dialog', { name: '워크 메모' }).parentElement).toBe(
    screen.getByRole('dialog', { name: '상세' }),
  );
  expect(screen.getByLabelText('메모')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('메모'), { target: { value: '새 기록' } });
  fireEvent.keyDown(screen.getByLabelText('메모'), { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '워크 메모' })).not.toBeInTheDocument(),
  );
  expect(save).toHaveBeenCalledWith('새 기록');
  expect(key).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
});

it('does not allow editing after a failed load and supports retry', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const load = vi.fn().mockRejectedValueOnce(new Error('조회 실패')).mockResolvedValue('기존');
  render(<MemoButton label="워크" value="" load={load} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: '워크 메모' }));
  expect(await screen.findByText('조회 실패')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByLabelText('메모')).toHaveValue('기존');
  expect(save).not.toHaveBeenCalled();
});
