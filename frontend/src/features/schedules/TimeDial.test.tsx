import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimeDial } from './TimeDial';
import { changeRange, dateInZone, nextDate, pointToMinutes } from './timeRange';
function Dial() {
  const [range, setRange] = useState({ start: '09:00', end: '10:00' });
  return <TimeDial {...range} onChange={setRange} />;
}
afterEach(() => vi.restoreAllMocks());
it('keeps endpoints independent for a multi-day schedule and displays the full duration', () => {
  const onChange = vi.fn();
  render(
    <TimeDial start="23:30" end="01:05" independentEndpoints daySpan={2} onChange={onChange} />,
  );
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'ArrowRight' });
  expect(onChange).toHaveBeenLastCalledWith({ start: '23:35', end: '01:05' });
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'ArrowLeft' });
  expect(onChange).toHaveBeenLastCalledWith({ start: '23:30', end: '01:00' });
  expect(screen.getByText(/25시간/)).toHaveTextContent('35분');
});
it('maps all four daylight positions and snaps to five minutes', () => {
  expect(pointToMinutes(0, -100)).toBe(0);
  expect(pointToMinutes(100, 0)).toBe(360);
  expect(pointToMinutes(0, 100)).toBe(720);
  expect(pointToMinutes(-100, 0)).toBe(1080);
  const angle = (367 / 1440) * Math.PI * 2;
  expect(pointToMinutes(Math.sin(angle) * 100, -Math.cos(angle) * 100)).toBe(365);
});
it('keeps a positive same-day interval at the edges and when crossing handles', () => {
  expect(changeRange('09:00', '10:00', 'start', 1080)).toEqual({ start: '10:00', end: '18:00' });
  expect(changeRange('09:00', '10:00', 'end', 0)).toEqual({ start: '00:00', end: '09:00' });
  expect(changeRange('09:00', '10:00', 'start', 1440)).toEqual({ start: '10:00', end: '23:55' });
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
  move(1200);
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '20:00',
  );
  move(1435);
  move(5);
  move(60);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '23:55',
  );
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  // Repeated rotations at midnight must not accumulate invisible movement.
  for (let lap = 0; lap < 3; lap++) {
    for (const minute of [360, 720, 1080, 1435, 5, 60]) move(minute);
  }
  move(55);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '23:50',
  );
  move(1430);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '22:45',
  );
  move(1080);
  move(1000);
  move(600);
  move(5);
  move(1435);
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '00:00',
  );
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '18:00',
  );
  move(10);
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute(
    'aria-valuetext',
    '00:15',
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

it('does not allow a midnight end handle on multi-day schedules', () => {
  const change = vi.fn();
  render(<TimeDial start="23:00" end="00:05" independentEndpoints daySpan={1} onChange={change} />);
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'Home' });
  expect(change).toHaveBeenLastCalledWith({ start: '23:00', end: '00:05' });
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'Home' });
  expect(change).toHaveBeenLastCalledWith({ start: '00:00', end: '00:05' });
});
