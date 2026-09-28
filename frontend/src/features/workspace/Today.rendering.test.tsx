import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { getDaySchedules, type ScheduleDetail } from '../../api/schedules';
import { emptyFields } from '../../api/works';
import { Today } from './Today';
import { TodayScheduleCard } from './TodayScheduleCard';

vi.mock('../../api/schedules');
vi.mock('./TodayScheduleCard', async (importOriginal) => {
  const original = await importOriginal<typeof import('./TodayScheduleCard')>();
  return { TodayScheduleCard: vi.fn(original.TodayScheduleCard) };
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('updates clock and schedule boundaries without rendering detail cards or losing drafts', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T08:59:59+09:00'));
  const item: ScheduleDetail = {
    id: 's',
    entity_id: 'e',
    title: '워크',
    scheduled_date: '2026-09-27',
    end_date: '2026-09-27',
    start_time: '09:00',
    end_time: '10:00',
    time_zone: 'Asia/Tokyo',
    status: 'planned',
    notes: '',
    created_at: '',
    updated_at: '',
    entity_snapshot: { ...emptyFields, name: '워크' },
    tasks: [
      {
        id: 't',
        status: 'pending',
        execution_notes: '',
        name_snapshot: '태스크',
        default_notes_snapshot: '',
        source_task_preset_version: 1,
        items: [
          {
            id: 'i',
            definition: {
              position: 0,
              label: '기록',
              item_type: 'text',
              required: false,
              unit: '',
              default_value: null,
            },
            value_text: null,
            value_number: null,
            value_boolean: null,
            completed: false,
          },
        ],
      },
    ],
  };
  vi.mocked(getDaySchedules).mockResolvedValue([item]);
  const view = render(<Today today="2026-09-27" timeZone="Asia/Tokyo" />);
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: '태스크 수정' }));
  fireEvent.change(screen.getByRole('textbox', { name: '기록' }), {
    target: { value: '미저장 초안' },
  });
  const renders = vi.mocked(TodayScheduleCard).mock.calls.length;
  const summary = within(screen.getByRole('region', { name: '오늘의 스케줄 목록' }));
  expect(summary.getByText(/09:00 — 10:00 · 예정/)).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole('img', { name: /현재 09:00/ })).toBeVisible();
  expect(summary.getByText(/09:00 — 10:00 · 진행 시간/)).toBeVisible();
  vi.setSystemTime(new Date('2026-09-27T09:59:59+09:00'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(summary.getByText(/09:00 — 10:00 · 시간 종료/)).toBeVisible();
  expect(TodayScheduleCard).toHaveBeenCalledTimes(renders);
  expect(screen.getByRole('textbox', { name: '기록' })).toHaveValue('미저장 초안');
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
