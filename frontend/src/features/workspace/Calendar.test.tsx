import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyFields } from '../../api/works';
import { getRangeSchedules, searchSchedules, type ScheduleDetail } from '../../api/schedules';
import { Calendar } from './Calendar';

vi.mock('../../api/schedules', () => ({ getRangeSchedules: vi.fn(), searchSchedules: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it.each(['day', 'month', 'year'] as const)(
  'opens search in %s view and links results to their detail',
  async (mode) => {
    vi.mocked(getRangeSchedules).mockResolvedValue([]);
    vi.mocked(searchSchedules).mockResolvedValue({
      items: [
        {
          id: 'saved-schedule',
          entity_id: 'work',
          title: '저장한 워크',
          scheduled_date: '2025-01-01',
          end_date: '2025-01-01',
          start_time: '09:00',
          end_time: '10:00',
          time_zone: 'Asia/Tokyo',
          notes: '',
          status: 'planned',
          created_at: '',
          updated_at: '',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<Calendar today="2026-09-25" mode={mode} />);
    const trigger = screen.getByRole('button', { name: '일정 검색' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: '일정 검색' })).toBeVisible();
    expect(screen.getByRole('searchbox', { name: '검색어' })).toHaveFocus();
    expect(await screen.findByRole('link', { name: /저장한 워크/ })).toHaveAttribute(
      'href',
      '#/schedules/saved-schedule',
    );
    expect(searchSchedules).toHaveBeenCalledWith('', 0, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  },
);

it('loads the whole year, aligns leap-day dates, shows schedule silhouettes, and opens a month', async () => {
  const schedules = [0, 5, 6, 10].map((completed, index): ScheduleDetail => ({
    id: String(index),
    entity_id: 'work',
    title: '',
    scheduled_date: `2024-02-${20 + index}`,
    end_date: `2024-02-${20 + index}`,
    start_time: '09:00',
    end_time: '10:00',
    time_zone: 'Asia/Tokyo',
    notes: '',
    status: 'planned',
    created_at: '',
    updated_at: '',
    entity_snapshot: emptyFields,
    tasks: Array.from({ length: 10 }, (_, task) => ({
      id: `${index}-${task}`,
      status: task < completed ? 'completed' : 'pending',
      execution_notes: '',
      name_snapshot: '',
      default_notes_snapshot: '',
      source_task_preset_version: 1,
      items: [],
    })),
  }));
  vi.mocked(getRangeSchedules).mockResolvedValue(schedules);
  const { container } = render(<Calendar today="2024-09-25" mode="year" />);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(getRangeSchedules).toHaveBeenCalledWith(
    '2024-01-01',
    '2024-12-31',
    expect.any(AbortSignal),
  );
  expect(container.querySelectorAll('.mini-day')).toHaveLength(366);
  const february = screen.getByRole('button', { name: '2월' });
  expect(february.querySelector('.calendar-week-cells')!.children[4]).toHaveAttribute(
    'data-date',
    '2024-02-01',
  );
  expect(february.querySelector('[data-date="2024-02-29"]')).toBeInTheDocument();
  expect(february.querySelectorAll('.calendar-bar')).toHaveLength(4);
  expect(february.querySelector('.calendar-grid')).toHaveTextContent('');
  expect(container.querySelector('[data-date="2024-02-20"]')).not.toHaveAttribute('style');
  fireEvent.click(screen.getByRole('button', { name: '다음 해' }));
  await waitFor(() =>
    expect(getRangeSchedules).toHaveBeenLastCalledWith(
      '2025-01-01',
      '2025-12-31',
      expect.any(AbortSignal),
    ),
  );
  expect(container.querySelectorAll('.mini-day')).toHaveLength(365);
});

it('switches calendar modes and opens the selected month from the year', async () => {
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  render(<Calendar today="2024-09-25" />);
  fireEvent.click(screen.getByRole('button', { name: '연간' }));
  fireEvent.click(screen.getByRole('button', { name: '2월' }));
  expect(screen.getByRole('button', { name: '월간' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: '2024년 2월' })).toBeInTheDocument();
  await waitFor(() =>
    expect(getRangeSchedules).toHaveBeenLastCalledWith(
      '2024-02-01',
      '2024-02-29',
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: /2월 15일.*일정/ }));
  expect(screen.getByRole('heading', { name: '2월 15일 목요일' })).toBeInTheDocument();
});

it('selects a date from a paged month picker and crosses the year boundary', async () => {
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  render(<Calendar today="2024-12-31" mode="day" />);
  fireEvent.click(screen.getByRole('button', { name: '날짜 선택' }));
  const picker = within(screen.getByRole('dialog', { name: '날짜 선택' }));
  expect(picker.getByRole('heading', { name: '2024년 12월' })).toBeInTheDocument();
  fireEvent.click(picker.getByRole('button', { name: '다음 달' }));
  expect(picker.getByRole('heading', { name: '2025년 1월' })).toBeInTheDocument();
  fireEvent.click(picker.getByRole('button', { name: /1월 1일.*일정/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '1월 1일 수요일' })).toBeInTheDocument();
  await waitFor(() =>
    expect(getRangeSchedules).toHaveBeenLastCalledWith(
      '2025-01-01',
      '2025-01-31',
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: '이전 날' }));
  expect(screen.getByRole('heading', { name: '12월 31일 화요일' })).toBeInTheDocument();
  await waitFor(() =>
    expect(getRangeSchedules).toHaveBeenLastCalledWith(
      '2024-12-01',
      '2024-12-31',
      expect.any(AbortSignal),
    ),
  );
});

it('keeps six picker weeks through short and long months, jumps to today, and restores focus', async () => {
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  render(<Calendar today="2026-02-01" mode="day" />);
  const trigger = screen.getByRole('button', { name: '날짜 선택' });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: '날짜 선택' });
  expect(dialog.querySelectorAll('.calendar-week')).toHaveLength(6);
  expect(within(dialog).getAllByRole('button', { name: /일정 0개/ })).toHaveLength(28);
  fireEvent.click(within(dialog).getByRole('button', { name: '다음 달' }));
  expect(dialog.querySelectorAll('.calendar-week')).toHaveLength(6);
  expect(within(dialog).getAllByRole('button', { name: /일정 0개/ })).toHaveLength(31);
  fireEvent.click(within(dialog).getByRole('button', { name: /3월 15일.*일정/ }));
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: '오늘' }));
  expect(screen.getByRole('heading', { name: '2월 1일 일요일' })).toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});

it('maps zooms to measured cells, replaces interrupted pages, and respects reduced motion', async () => {
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  const animate = vi.fn<(frames: Keyframe[], options: KeyframeAnimationOptions) => Animation>(
    () => ({ cancel: vi.fn(), onfinish: null }) as unknown as Animation,
  );
  const bounds = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      return (
        this.matches('[data-date]')
          ? { left: 100, top: 200, width: 80, height: 60 }
          : { left: 20, top: 40, width: 800, height: 600 }
      ) as DOMRect;
    });
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = animate as unknown as typeof original;
  try {
    const { unmount } = render(<Calendar today="2026-09-26" />);
    fireEvent.click(screen.getByRole('button', { name: /9월 26일.*일정/ }));
    expect(animate.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ transform: 'translate(80px, 160px) scale(0.1, 0.1)' }),
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: '다음 날' }));
    fireEvent.click(screen.getByRole('button', { name: '이전 날' }));
    expect(document.querySelectorAll('[aria-hidden="true"][inert]')).toHaveLength(1);
    document.documentElement.dataset.motion = 'reduced';
    animate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '월간' }));
    expect(animate).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[aria-hidden="true"][inert]')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    unmount();
  } finally {
    delete document.documentElement.dataset.motion;
    HTMLElement.prototype.animate = original;
    bounds.mockRestore();
  }
});

it('keeps both moving picker pages inside a stationary viewport and cleans interrupted transitions', async () => {
  vi.mocked(getRangeSchedules).mockResolvedValue([]);
  const targets: HTMLElement[] = [];
  const animate = vi.fn(function (this: HTMLElement) {
    targets.push(this);
    return { cancel: vi.fn(), onfinish: null } as unknown as Animation;
  });
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = animate as unknown as typeof original;
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 200,
    width: 350,
    height: 304,
  } as DOMRect);
  try {
    render(<Calendar today="2026-02-01" mode="day" />);
    fireEvent.click(screen.getByRole('button', { name: '날짜 선택' }));
    const dialog = screen.getByRole('dialog', { name: '날짜 선택' });
    const viewport = dialog.querySelector('[data-calendar-viewport]')!;
    for (const direction of ['다음 달', '다음 달', '이전 달']) {
      fireEvent.click(within(dialog).getByRole('button', { name: direction }));
      const outgoing = viewport.querySelector<HTMLElement>('[inert]')!;
      expect(outgoing).not.toBeNull();
      expect(outgoing.parentElement).toBe(viewport);
      expect(outgoing.style.position).toBe('absolute');
      expect(outgoing).not.toHaveAttribute('popover');
      expect(document.querySelectorAll('[aria-hidden="true"][inert]')).toHaveLength(1);
      expect(targets.slice(-2).every((target) => target.parentElement === viewport)).toBe(true);
      expect(targets).not.toContain(viewport);
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelectorAll('[aria-hidden="true"][inert]')).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  } finally {
    HTMLElement.prototype.animate = original;
    bounds.mockRestore();
  }
});
