import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TodayDial } from './TodayDial';
import { emptyFields } from '../../api/works';
import type { ScheduleDetail } from '../../api/schedules';

const item: ScheduleDetail = {
  id: 'one',
  entity_id: 'work',
  title: 'overnight',
  scheduled_date: '2026-09-24',
  end_date: '2026-09-25',
  start_time: '23:00',
  end_time: '01:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'planned',
  created_at: '',
  updated_at: '',
  entity_snapshot: emptyFields,
  tasks: [],
};
it('shows the saved-zone current time and clips overnight schedules to the day', () => {
  const view = render(
    <TodayDial
      today="2026-09-24"
      timeZone="Asia/Tokyo"
      now={new Date('2026-09-24T14:30:00Z')}
      items={[item, { ...item, id: 'cancelled', status: 'cancelled' }]}
    />,
  );
  expect(screen.getByRole('img', { name: /현재 23:30, 스케줄 1개/ })).toBeInTheDocument();
  const arc = view.container.querySelector('.today-work-arc circle[stroke-dasharray]')!;
  const [length, circumference] = arc.getAttribute('stroke-dasharray')!.split(' ').map(Number);
  expect(length! / circumference!).toBeCloseTo(1 / 24);
  view.rerender(
    <TodayDial
      today="2026-09-25"
      timeZone="Asia/Tokyo"
      now={new Date('2026-09-24T15:30:00Z')}
      items={[item]}
    />,
  );
  expect(screen.getByRole('img', { name: /현재 00:30/ })).toBeInTheDocument();
  expect(view.container.querySelector('.today-work-arc circle[stroke-dasharray]')).toHaveAttribute(
    'stroke-dashoffset',
    '0',
  );
});
it('renders overlapping schedules on separate rings', () => {
  const view = render(
    <TodayDial
      today="2026-09-24"
      timeZone="Asia/Tokyo"
      now={new Date()}
      items={[item, { ...item, id: 'two' }]}
    />,
  );
  const rings = view.container.querySelectorAll('.today-work-arc:not([data-continuation]) circle');
  expect(rings).toHaveLength(2);
  expect(rings[0]!.getAttribute('r')).not.toBe(rings[1]!.getAttribute('r'));
});

it('keeps well-separated schedules at the same full width', () => {
  const props = {
    today: '2026-09-24',
    timeZone: 'Asia/Tokyo',
    now: new Date('2026-09-24T03:00:00Z'),
    items: Array.from({ length: 5 }, (_, i) => ({
      ...item,
      id: String(i),
      end_date: '2026-09-24',
      start_time: `${String(9 + i * 2).padStart(2, '0')}:00`,
      end_time: `${10 + i * 2}:00`,
    })),
  };
  const view = render(<TodayDial {...props} />);
  const widths = () =>
    Array.from(view.container.querySelectorAll('.today-work-arc circle'), (e) =>
      Number(e.getAttribute('stroke-width')),
    );
  const initial = widths();
  expect(new Set(initial).size).toBe(1);
  expect(Math.min(...initial)).toBe(28);
  expect(Math.max(...initial)).toBe(28);
  view.rerender(<TodayDial {...props} now={new Date('2026-09-24T03:01:00Z')} />);
  expect(widths()).toEqual(initial);
});

it('omits untimed work and shows start-only work as one status marker on its start day', () => {
  const items = [
    { ...item, id: 'untimed', start_time: '', end_time: '' },
    { ...item, id: 'start', end_time: '' },
  ];
  const props = { today: item.scheduled_date, now: new Date('2026-09-24T14:30:00Z'), items };
  const view = render(<TodayDial {...props} />);
  expect(screen.getByRole('img', { name: /스케줄 1개/ })).toBeInTheDocument();
  expect(view.container.querySelectorAll('.today-work-marker line')).toHaveLength(1);
  expect(view.container.querySelector('.today-work-marker line')).toHaveAttribute(
    'stroke',
    'var(--status-overdue)',
  );
  expect(view.container.querySelector('.today-work-arc')).not.toBeInTheDocument();
  view.rerender(<TodayDial {...props} today={item.end_date} />);
  expect(screen.getByRole('img', { name: /스케줄 0개/ })).toBeInTheDocument();
});

it.each(['01:00', ''])(
  'updates arcs and start-only markers immediately on completion and reopen (%s)',
  (endTime) => {
    const original = { ...item, end_time: endTime };
    const props = { today: item.scheduled_date, now: new Date('2026-09-24T14:30:00Z') };
    const view = render(<TodayDial {...props} items={[original]} />);
    const shape = () => view.container.querySelector('.today-work-arc, .today-work-marker');
    expect(shape()).toHaveAttribute('data-state', endTime ? 'current' : 'overdue');
    view.rerender(<TodayDial {...props} items={[{ ...original, status: 'completed' }]} />);
    expect(shape()).toHaveAttribute('data-state', 'completed');
    expect(shape()?.querySelector('circle, line')?.getAttribute('stroke')).toContain('hsl(140');
    view.rerender(<TodayDial {...props} items={[original]} />);
    expect(shape()).toHaveAttribute('data-state', endTime ? 'current' : 'overdue');
  },
);

it('fades and blurs only the continuation after midnight and restores a solid arc on the next day', () => {
  const props = { today: '2026-09-24', now: new Date('2026-09-24T14:30:00Z'), items: [item] };
  const view = render(<TodayDial {...props} />);
  const tail = view.container.querySelector('[data-continuation]')!;
  expect(tail.querySelectorAll('circle')).toHaveLength(3);
  expect(tail.querySelectorAll('mask')).toHaveLength(4);
  expect(tail.querySelector('g[filter]')).toHaveAttribute(
    'filter',
    expect.stringContaining('-blur)'),
  );
  const stops = [...tail.querySelectorAll('linearGradient:first-child stop')];
  const opacity = stops.map((stop) => Number(stop.getAttribute('stop-opacity')));
  expect(opacity[0]).toBe(1);
  expect(opacity.at(-1)).toBe(0);
  expect(opacity.every((value, index) => index === 0 || value < opacity[index - 1]!)).toBe(true);
  expect(tail).toHaveAttribute('mask', expect.stringContaining('-separation-markers)'));
  expect(tail.querySelector('g[filter] > g[mask]')).toBeInTheDocument();
  const finalFade = tail.querySelector('[data-tail-fade-end]')!;
  expect(finalFade).toHaveAttribute('data-tail-fade-end', '90');
  expect(finalFade.querySelectorAll('g[filter]')).toHaveLength(2);
  const fadeGradient = tail.querySelector('linearGradient[id$="-fade-gradient"]')!;
  expect(fadeGradient.lastElementChild).toHaveAttribute('stop-opacity', '0');
  const stroke = tail.querySelector('circle')!;
  const [length, circumference] = stroke.getAttribute('stroke-dasharray')!.split(' ').map(Number);
  expect(length! / circumference!).toBeCloseTo(2 / 24);
  // Its zero-opacity edge is the full 01:30 radial line, not a chord across the stroke.
  const dx = Number(fadeGradient.getAttribute('x2')) - Number(fadeGradient.getAttribute('x1'));
  const dy = Number(fadeGradient.getAttribute('y2')) - Number(fadeGradient.getAttribute('y1'));
  expect(dy / dx).toBeCloseTo(Math.tan(Math.PI / 8));
  expect(view.container.querySelector('.today-work-arc circle')).toHaveAttribute(
    'stroke-linecap',
    'round',
  );
  expect(screen.getByRole('img', { name: /스케줄 1개/ })).toBeInTheDocument();
  view.rerender(<TodayDial {...props} today="2026-09-25" />);
  expect(view.container.querySelector('[data-continuation]')).not.toBeInTheDocument();
  expect(view.container.querySelector('.today-work-arc g')).not.toHaveAttribute('opacity');
});

it('keeps markers above every arc unmasked, cutting only the underlying arcs', () => {
  const view = render(
    <TodayDial
      today="2026-09-24"
      now={new Date('2026-09-24T14:30:00Z')}
      items={[item, { ...item, id: 'marker', start_time: '23:30', end_time: '' }]}
    />,
  );
  const layer = view.container.querySelector('[data-schedule-layer]')!;
  const mask = view.container.querySelector('mask[id$="-separation"]')!;
  expect(layer).not.toHaveAttribute('mask');
  expect(layer.querySelector('.today-work-arc:not([data-continuation])')).toHaveAttribute(
    'mask',
    `url(#${mask.id})`,
  );
  expect(layer.querySelector('.today-work-marker')).not.toBeInTheDocument();
  const markerLayer = view.container.querySelector('[data-marker-layer]')!;
  expect(markerLayer.parentElement!.lastElementChild).toBe(markerLayer);
  expect(markerLayer.querySelector('.today-work-marker')!.closest('[mask]')).toBeNull();
  const blurMask = view.container.querySelector('mask[id$="-separation-markers"]')!;
  expect(blurMask.querySelector('rect[mask]')).toBeNull();
  expect(blurMask.querySelector('line')).toHaveAttribute('stroke-width', '5.6');
  expect(layer.querySelector('.today-work-arc')).toBeInTheDocument();
  expect(layer.querySelector('.hour-tick')).not.toBeInTheDocument();
  expect(mask.querySelectorAll('rect[fill="black"][mask]')).toHaveLength(1);
  const outlines = [...view.container.querySelectorAll('mask[id*="-outline-"]')];
  expect(outlines).toHaveLength(1); // Only solid arcs use outlines; markers and blur stay clear.
  for (const outline of outlines) {
    const outer = outline.querySelector('[stroke="white"]')!;
    const inner = outline.querySelector('[stroke="black"]')!;
    expect(
      Number(outer.getAttribute('stroke-width')) - Number(inner.getAttribute('stroke-width')),
    ).toBeCloseTo(1.6);
    expect(outer).toHaveAttribute('stroke-linecap', 'round');
  }
});
