import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimeDial } from './TimeDial';
import { changeRange, dateInZone, nextDate, pointToMinutes } from './timeRange';
function Dial() {
  const [range, setRange] = useState({ start: '09:00', end: '10:00', daySpan: 0 });
  return <TimeDial {...range} onChange={setRange} />;
}
afterEach(() => vi.restoreAllMocks());
it('keeps the clock across midnight and caps its duration at 24 hours', () => {
  const onChange = vi.fn();
  render(<TimeDial start="23:30" end="01:05" daySpan={1} onChange={onChange} />);
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'Home' });
  expect(onChange).toHaveBeenLastCalledWith({ start: '23:30', end: '00:00', daySpan: 1 });
  expect(screen.getByText(/1시간/)).toHaveTextContent('35분');
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'End' });
  expect(onChange).toHaveBeenLastCalledWith({ start: '23:30', end: '23:30', daySpan: 1 });
});
it('maps all four daylight positions and snaps to five minutes', () => {
  expect(pointToMinutes(0, -100)).toBe(0);
  expect(pointToMinutes(100, 0)).toBe(360);
  expect(pointToMinutes(0, 100)).toBe(720);
  expect(pointToMinutes(-100, 0)).toBe(1080);
  const angle = (367 / 1440) * Math.PI * 2;
  expect(pointToMinutes(Math.sin(angle) * 100, -Math.cos(angle) * 100)).toBe(365);
});
it('blocks crossing handles while preserving the fixed endpoint', () => {
  expect(changeRange('09:00', '10:00', 'start', 1080)).toEqual({
    start: '09:59',
    end: '10:00',
    daySpan: 0,
  });
  expect(changeRange('09:00', '10:00', 'end', 0)).toEqual({
    start: '09:00',
    end: '09:01',
    daySpan: 0,
  });
  expect(changeRange('23:00', '01:00', 'end', 3000, 5, 1)).toEqual({
    start: '23:00',
    end: '23:00',
    daySpan: 1,
  });
  expect(changeRange('23:00', '01:00', 'start', 0, 5, 1)).toEqual({
    start: '01:00',
    end: '01:00',
    daySpan: 1,
  });
});
it('offers keyboard changes and spoken time values for both handles', () => {
  render(<Dial />);
  const start = screen.getByRole('slider', { name: '시작 시간' });
  fireEvent.keyDown(start, { key: 'ArrowRight' });
  expect(start).toHaveAttribute('aria-valuetext', '09:05');
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'PageUp' });
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '11:00',
  );
});
it('supports tap selection, pointer capture, dragging outside the face, and cancellation', () => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
      pointerType = 'touch';
    },
  );
  const capture = vi.fn();
  HTMLElement.prototype.setPointerCapture = capture;
  HTMLElement.prototype.hasPointerCapture = () => true;
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  render(<Dial />);
  const face = screen.getByTestId('time-dial');
  vi.spyOn(face, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 360,
    height: 360,
    right: 360,
    bottom: 360,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(face, { clientX: 320, clientY: 180 });
  fireEvent.pointerUp(face, { clientX: 320, clientY: 180 });
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '06:00',
  );
  fireEvent.pointerDown(face, { clientX: 180, clientY: 320 });
  fireEvent.pointerUp(face, { clientX: 180, clientY: 320 });
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '12:00',
  );
  fireEvent.pointerDown(screen.getByRole('slider', { name: '종료 시간' }), {
    clientX: 180,
    clientY: 320,
  });
  fireEvent.pointerMove(face, { clientX: -20, clientY: 180 });
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  fireEvent.pointerCancel(face);
  fireEvent.pointerMove(face, { clientX: 180, clientY: 320 });
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  function move(minute: number) {
    const angle = (minute / 1440) * Math.PI * 2;
    fireEvent.pointerMove(face, {
      clientX: 180 + Math.sin(angle) * 140,
      clientY: 180 - Math.cos(angle) * 140,
    });
  }
  fireEvent.pointerDown(screen.getByRole('slider', { name: '시작 시간' }), {
    clientX: 320,
    clientY: 180,
  });
  move(720);
  move(1085);
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '17:59',
  );
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  fireEvent.pointerUp(face);
  fireEvent.pointerDown(screen.getByRole('slider', { name: '종료 시간' }), {
    clientX: 40,
    clientY: 180,
  });
  move(1435);
  move(5);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '00:05',
  );
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '17:59',
  );
  move(1435);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '23:55',
  );
  fireEvent.pointerUp(face);
  expect(capture).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it('does not allow disabled dial edits', () => {
  const change = vi.fn();
  render(<TimeDial start="09:00" end="10:00" disabled onChange={change} />);
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'ArrowRight' });
  expect(change).not.toHaveBeenCalled();
});
it('uses app time zone and crosses leap-day/year boundaries', () => {
  expect(dateInZone('Asia/Tokyo', new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-25');
  expect(nextDate('2028-02-28')).toBe('2028-02-29');
  expect(nextDate('2026-12-31')).toBe('2027-01-01');
});

it('adjusts the focused time with visible arrow buttons', () => {
  const onChange = vi.fn();
  render(<TimeDial start="09:00" end="10:00" onChange={onChange} />);
  expect(screen.queryByRole('button', { name: '시간 늘리기' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  const selectedBox = screen
    .getByRole('button', { name: '시작 시간' })
    .closest('.time-endpoint-box');
  expect(selectedBox).toHaveAttribute('data-active', 'true');
  expect(selectedBox).toContainElement(screen.getByRole('button', { name: '시간 늘리기' }));
  fireEvent.click(screen.getByRole('button', { name: '시간 늘리기' }));
  expect(onChange).toHaveBeenLastCalledWith({ start: '09:05', end: '10:00', daySpan: 0 });
});

it('blocks wheel values crossing the fixed endpoint', () => {
  render(<Dial />);
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'End' });
  expect(screen.getByRole('button', { name: '적용' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'Home' });
  expect(screen.getByRole('button', { name: '적용' })).toBeEnabled();
});

it('rolls the end wheel forward through midnight and back without changing the start', () => {
  function Overnight() {
    const [range, setRange] = useState({ start: '23:00', end: '23:55', daySpan: 0 });
    return <TimeDial {...range} onChange={setRange} />;
  }
  render(<Overnight />);
  fireEvent.click(screen.getByRole('button', { name: '종료 시간' }));
  fireEvent.click(screen.getByRole('button', { name: '종료 시간' }));
  fireEvent.keyDown(screen.getByRole('listbox', { name: '시' }), { key: 'Home' });
  fireEvent.keyDown(screen.getByRole('listbox', { name: '분' }), { key: 'Home' });
  expect(screen.getByRole('button', { name: '적용' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuenow',
    '1440',
  );
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'ArrowLeft' });
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuenow',
    '1435',
  );
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '23:00',
  );
});

it('starts with one dial and clearing the start also clears the end', () => {
  function Empty() {
    const [range, setRange] = useState({ start: '', end: '', daySpan: 0 });
    return <TimeDial {...range} onChange={setRange} />;
  }
  render(<Empty />);
  expect(screen.getAllByRole('slider')).toHaveLength(1);
  expect(screen.getByRole('button', { name: '시작 시간' })).toBeVisible();
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'PageUp' });
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'PageUp' });
  fireEvent.click(screen.getByRole('button', { name: '시작 시간' }));
  fireEvent.click(screen.getByRole('button', { name: '시간 지정 해제' }));
  expect(screen.getAllByRole('slider')).toHaveLength(1);
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '지정 없음');
});
