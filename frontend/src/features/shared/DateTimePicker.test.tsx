import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DatePicker, TimePicker } from './DateTimePicker';
import { PresetModal } from './PresetModal';

it('animates explicit wheel selection without overwriting the intermediate scroll position', () => {
  const scrollTo = vi.fn();
  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
  try {
    render(<TimePicker label="시간" value="09:17" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '시간' }));
    const hour = screen.getByRole('listbox', { name: '시' });
    expect(hour.scrollTop).toBe(9 * 44);
    fireEvent.keyDown(hour, { key: 'ArrowDown' });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 10 * 44, behavior: 'smooth' });
    expect(hour.scrollTop).toBe(9 * 44);
    document.documentElement.dataset.motion = 'reduced';
    fireEvent.keyDown(hour, { key: 'ArrowDown' });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 11 * 44, behavior: 'instant' });
  } finally {
    delete document.documentElement.dataset.motion;
    if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollTo', previous);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  }
});

it('commits settled wheel scrolling as a draft without snapping it back', () => {
  vi.useFakeTimers();
  try {
    const change = vi.fn();
    render(<TimePicker label="시간" value="09:17" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: '시간' }));
    act(() => vi.advanceTimersByTime(20));
    const hour = screen.getByRole('listbox', { name: '시' });
    hour.scrollTop = 12 * 44;
    fireEvent.scroll(hour);
    act(() => vi.advanceTimersByTime(100));
    expect(hour.scrollTop).toBe(12 * 44);
    expect(within(hour).getByRole('option', { name: '12' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(change).toHaveBeenCalledWith('12:17');
  } finally {
    vi.useRealTimers();
  }
});

it('keeps date and time popup controls inside their owning modal', () => {
  render(
    <PresetModal label="편집" onClose={vi.fn()}>
      <TimePicker label="시간" value="09:17" onChange={vi.fn()} />
      <DatePicker label="날짜" value="2026-09-27" onChange={vi.fn()} />
    </PresetModal>,
  );
  const modal = screen.getByRole('dialog', { name: '편집' });
  fireEvent.click(screen.getByRole('button', { name: '시간' }));
  expect(modal).toContainElement(screen.getByRole('dialog', { name: '시간' }));
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'Escape' });
  expect(modal).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '날짜' }));
  expect(modal).toContainElement(screen.getByRole('dialog', { name: '날짜 선택' }));
});

it('uses shared entry and exit animations and applies only after exit', async () => {
  const change = vi.fn();
  let finish!: () => void;
  const animate = vi.fn(() => ({
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  }));
  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  try {
    render(<TimePicker label="시간" value="09:17" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: '시간' }));
    await act(async () => {});
    expect(animate).toHaveBeenCalled();
    expect(animate.mock.calls[0]).toEqual(
      expect.arrayContaining([expect.arrayContaining([expect.objectContaining({ opacity: 0 })])]),
    );
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => finish());
    expect(change).toHaveBeenCalledWith('09:17');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    if (previous) Object.defineProperty(HTMLElement.prototype, 'animate', previous);
    else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  }
});

it('opens a non-modal anchored popup and cancels on Escape or outside pointer', () => {
  const change = vi.fn();
  const parentEscape = vi.fn();
  render(
    <div onKeyDown={parentEscape}>
      <TimePicker label="시작 시간" value="09:17" onChange={change} />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: '시작 시간' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toHaveAttribute('popover', 'manual');
  expect(screen.getByRole('dialog').tagName).toBe('DIV');
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(parentEscape).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});

it('keeps wheel changes as a draft until apply and preserves minute precision', () => {
  const change = vi.fn();
  render(<TimePicker label="시작 시간" value="09:17" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'ArrowDown' });
  fireEvent.keyDown(screen.getByRole('listbox', { name: '분' }), { key: 'ArrowDown' });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
  expect(change).toHaveBeenCalledWith('10:18');
});

it('cancels wheel edits, restores focus and prevents a midnight end', () => {
  const change = vi.fn();
  render(<TimePicker label="종료 시간" value="" min="00:01" onChange={change} />);
  const trigger = screen.getByRole('button', { name: '종료 시간' });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('listbox', { name: '분' }), { key: 'Home' });
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '상세 닫기' }));
  expect(change).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  expect(
    within(screen.getByRole('listbox', { name: '분' })).getByRole('option', { name: '01' }),
  ).toHaveAttribute('aria-selected', 'true');
});

it('reuses the calendar across a year boundary and returns focus after selection', async () => {
  const change = vi.fn();
  render(<DatePicker label="시작 날짜" value="2026-12-31" onChange={change} />);
  const trigger = screen.getByRole('button', { name: '시작 날짜' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
  fireEvent.click(document.querySelector('[data-date="2027-01-01"]')!);
  await waitFor(() => expect(change).toHaveBeenCalledWith('2027-01-01'));
  expect(trigger).toHaveFocus();
});
