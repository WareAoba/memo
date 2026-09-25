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
  expect(screen.getByRole('img', { name: /현재 23:30, 일정 1개/ })).toBeInTheDocument();
  const arc = view.container.querySelector('circle[stroke-dasharray]')!;
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
  expect(view.container.querySelector('circle[stroke-dasharray]')).toHaveAttribute(
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
  const rings = view.container.querySelectorAll('circle[stroke-dasharray]');
  expect(rings).toHaveLength(2);
  expect(rings[0]!.getAttribute('r')).not.toBe(rings[1]!.getAttribute('r'));
});

it('uses stable stepped outer heights to distinguish consecutive schedules', () => {
  const props = {
    today: '2026-09-24',
    timeZone: 'Asia/Tokyo',
    now: new Date('2026-09-24T03:00:00Z'),
    items: Array.from({ length: 5 }, (_, i) => ({
      ...item,
      id: String(i),
      end_date: '2026-09-24',
      start_time: `${String(9 + i).padStart(2, '0')}:00`,
      end_time: `${10 + i}:00`,
    })),
  };
  const view = render(<TodayDial {...props} />);
  const widths = () =>
    Array.from(view.container.querySelectorAll('.today-work-arc > circle'), (e) =>
      Number(e.getAttribute('stroke-width')),
    );
  const initial = widths();
  expect(new Set(initial).size).toBe(5);
  expect(Math.min(...initial)).toBe(28);
  expect(Math.max(...initial)).toBe(36);
  view.rerender(<TodayDial {...props} now={new Date('2026-09-24T03:01:00Z')} />);
  expect(widths()).toEqual(initial);
});
