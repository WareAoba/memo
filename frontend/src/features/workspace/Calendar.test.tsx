import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const trigger = screen.getByRole('button', { name: '스케줄 검색' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: '스케줄 검색' })).toBeVisible();
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

it('loads the whole year, aligns leap-day dates, colors task completion, and opens a month', async () => {
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
  expect(february.querySelector('.mini-days')!.children[4]).toHaveAttribute(
    'data-date',
    '2024-02-01',
  );
  expect(february.querySelector('[data-date="2024-02-29"]')).toBeInTheDocument();
  for (const [index, rate] of [0, 50, 60, 100].entries()) {
    const day = container.querySelector(`[data-date="2024-02-${20 + index}"]`)!;
    expect(day).toHaveAttribute('title', expect.stringContaining(`달성률 ${rate}%`));
    expect(day).toHaveStyle({ color: rate < 60 ? 'var(--danger)' : 'var(--success)' });
  }
  expect(container.querySelector('[data-date="2024-02-24"]')).not.toHaveAttribute('style');
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
