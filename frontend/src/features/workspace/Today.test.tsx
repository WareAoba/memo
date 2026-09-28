import { listTaskPresets } from '../../api/taskPresets';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Today } from './Today';
import {
  getDaySchedules,
  updateTask,
  reopenSchedule,
  deleteSchedule,
  deleteScheduleTask,
  completeSchedule,
  addScheduleTask,
  type ScheduleDetail,
} from '../../api/schedules';
import { emptyFields } from '../../api/works';
import { progressOf } from './progress';
vi.mock('../../api/schedules');
vi.mock('../../api/taskPresets');
vi.mock('../schedules/Photos', () => ({ Photos: () => null }));
afterEach(() => vi.resetAllMocks());
it('preserves item drafts after midnight despite memo events and revision refreshes', async () => {
  const original: ScheduleDetail = {
    ...schedule,
    scheduled_date: '2026-09-24',
    end_date: '2026-09-24',
    tasks: [
      {
        ...schedule.tasks[2]!,
        items: [
          {
            id: 'item',
            definition: {
              position: 0,
              label: '기록',
              item_type: 'text',
              required: false,
              unit: '',
              default_value: null,
            },
            value_text: null,
            value_boolean: null,
            value_number: null,
            completed: false,
          },
        ],
      },
    ],
  };
  vi.mocked(getDaySchedules).mockImplementation(async (date) =>
    date === '2026-09-24' ? [original] : [],
  );
  vi.mocked(updateTask).mockImplementation(async (_id, patch) => {
    window.dispatchEvent(new Event('schedules-changed'));
    return {
      ...original,
      tasks: original.tasks.map((task) => ({
        ...task,
        execution_notes: patch.execution_notes ?? '',
      })),
    };
  });
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '태스크 2 수정' }));
  fireEvent.change(screen.getByRole('textbox', { name: '기록' }), {
    target: { value: '미저장 실행 초안' },
  });
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" />);
  fireEvent.change(screen.getByLabelText('실행 메모'), { target: { value: '별도 메모' } });
  fireEvent.blur(screen.getByLabelText('실행 메모'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.queryByText(/^(메모를 저장했습니다\.|저장했습니다\.|자동 저장)$/),
  ).not.toBeInTheDocument();
  fireEvent(window, new Event('focus'));
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" revision={1} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('textbox', { name: '기록' })).toHaveValue('미저장 실행 초안');
  fireEvent.click(screen.getByRole('button', { name: '태스크 2 수정' }));
  await screen.findByText('오늘 저장된 스케줄이 없습니다.');
  expect(getDaySchedules).toHaveBeenLastCalledWith('2026-09-25', expect.any(AbortSignal));
});
const schedule: ScheduleDetail = {
  id: 's',
  entity_id: 'e',
  title: '스케줄',
  scheduled_date: '2026-09-23',
  end_date: '2026-09-25',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  status: 'planned',
  notes: '',
  created_at: '',
  updated_at: '',
  entity_snapshot: { ...emptyFields, name: '저장된 워크', advance_contact_required: true },
  tasks: ['completed', 'skipped', 'pending'].map((status, i) => ({
    id: String(i),
    status,
    execution_notes: '',
    name_snapshot: '태스크 ' + i,
    default_notes_snapshot: '',
    source_task_preset_version: 1,
    items: [],
  })),
};
it('selects one work, reveals a labeled footer action and omits empty explanations', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([
    { ...schedule, title: schedule.entity_snapshot.name, tasks: [], color: 'red' },
    {
      ...schedule,
      id: 'second',
      entity_snapshot: { ...emptyFields, name: '다른 워크' },
      tasks: [],
    },
  ]);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  const card = await screen.findByRole('article', { name: '저장된 워크' });
  expect(card).toHaveAttribute('data-schedule-color', 'red');
  expect(screen.getByRole('heading', { name: '요약' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '오늘의 스케줄' })).toBeVisible();
  expect(screen.queryByText('이번 스케줄에 저장됩니다')).not.toBeInTheDocument();
  expect(
    screen.queryByText('태스크를 추가해 이 워크의 할 일을 준비하세요.'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '+ 태스크 추가' })).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: '저장된 워크' }));
  expect(card).toHaveAttribute('data-selected', 'true');
  const add = within(card).getByRole('button', { name: '+ 태스크 추가' });
  expect(add).toHaveTextContent('태스크 추가');
  expect(add.closest('footer')).not.toBeNull();
  expect(within(card).queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
  expect(within(card).getByRole('link', { name: '스케줄 수정' })).toHaveAttribute(
    'href',
    '#/schedules/s/edit',
  );
  fireEvent.click(screen.getByRole('button', { name: '다른 워크' }));
  expect(card).toHaveAttribute('data-selected', 'false');
  expect(within(card).queryByRole('button', { name: '+ 태스크 추가' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: '+ 태스크 추가' })).toHaveLength(1);
});
it('completes a taskless schedule from its card and retains state on failure', async () => {
  const empty = { ...schedule, tasks: [] };
  vi.mocked(getDaySchedules).mockResolvedValue([empty]);
  vi.mocked(completeSchedule)
    .mockRejectedValueOnce(new Error('완료 실패'))
    .mockResolvedValueOnce({ ...empty, status: 'completed' });
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  const check = await screen.findByRole('checkbox', { name: '저장된 워크 모든 태스크 완료' });
  fireEvent.click(check);
  expect(await screen.findByText('완료 실패')).toBeVisible();
  expect(check).not.toBeChecked();
  fireEvent.click(check);
  await waitFor(() => expect(check).toBeChecked());
  expect(completeSchedule).toHaveBeenLastCalledWith('s');
  expect(check).toBeEnabled();
  vi.mocked(reopenSchedule).mockResolvedValue(empty);
  fireEvent.click(screen.getByRole('button', { name: '저장된 워크 완료 취소' }));
  await waitFor(() => expect(check).not.toBeChecked());
  expect(reopenSchedule).toHaveBeenCalledWith('s');
});
it('loads real snapshots, requirements, multi-day range and honest progress', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  expect(await screen.findByRole('button', { name: '저장된 워크' })).toBeVisible();
  expect(screen.getByText('사전 연락 필요')).toBeVisible();
  expect(screen.getByText('2026-09-23 — 2026-09-25')).toBeVisible();
  expect(screen.getByLabelText('오늘의 태스크 진행률')).toHaveTextContent('1/3');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  expect(progressOf([{ ...schedule, status: 'cancelled' }])).toEqual({
    total: 0,
    completed: 0,
    skipped: 0,
  });
});
it('waits for user timezone and retries errors without examples', async () => {
  vi.mocked(getDaySchedules).mockRejectedValueOnce(new Error('조회 실패')).mockResolvedValue([]);
  const view = render(<Today today="2026-09-24" />);
  expect(getDaySchedules).not.toHaveBeenCalled();
  view.rerender(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  expect(await screen.findByText('조회 실패')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  expect(await screen.findByText('오늘 저장된 스케줄이 없습니다.')).toBeVisible();
});
it('ignores an old date request after rollover', async () => {
  let resolve!: (items: ScheduleDetail[]) => void;
  vi.mocked(getDaySchedules)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue([]);
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" />);
  expect(await screen.findByText('오늘 저장된 스케줄이 없습니다.')).toBeVisible();
  resolve([schedule]);
  await waitFor(() => expect(screen.queryByText('저장된 워크')).not.toBeInTheDocument());
});

it('updates saved progress after a successful check and preserves it on failed undo', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(updateTask)
    .mockResolvedValueOnce({
      ...schedule,
      tasks: schedule.tasks.map((t) => (t.id === '2' ? { ...t, status: 'completed' } : t)),
    })
    .mockRejectedValueOnce(new Error('저장 실패'));
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('checkbox', { name: '태스크 2 완료' }));
  await waitFor(() =>
    expect(screen.getByLabelText('오늘의 태스크 진행률')).toHaveTextContent('2/3'),
  );
  expect(screen.getByRole('checkbox', { name: '태스크 2 완료' })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '태스크 2 완료' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByRole('checkbox', { name: '태스크 2 완료' })).toBeChecked();
  expect(screen.getByRole('link', { name: '상세 보기' })).toHaveAttribute('href', '#/schedules/s');
});

it('completes a work atomically and updates every task and progress', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(completeSchedule).mockResolvedValue({
    ...schedule,
    status: 'completed',
    tasks: schedule.tasks.map((t) => ({ ...t, status: 'completed' })),
  });
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크 모든 태스크 완료' }));
  await waitFor(() =>
    expect(screen.getByLabelText('오늘의 태스크 진행률')).toHaveTextContent('3/3'),
  );
  expect(completeSchedule).toHaveBeenCalledWith('s');
  expect(
    screen.getAllByRole('checkbox').every((input) => (input as HTMLInputElement).checked),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: '새로고침' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '스케줄 추가' })).not.toBeInTheDocument();
});
it('keeps tasks unchanged when bulk completion fails', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(completeSchedule).mockRejectedValue(new Error('필수 입력 필요'));
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크 모든 태스크 완료' }));
  expect(await screen.findByText('필수 입력 필요')).toBeVisible();
  expect(screen.getByRole('checkbox', { name: '태스크 2 완료' })).not.toBeChecked();
});
it('edits a task in place and adds only a task to its existing schedule', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(updateTask).mockResolvedValue({
    ...schedule,
    tasks: schedule.tasks.map((t) => (t.id === '2' ? { ...t, name_snapshot: '수정된 태스크' } : t)),
  });
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [{ id: 'preset', name: '추가할 태스크' }],
    total: 1,
    offset: 0,
    limit: 20,
  } as Awaited<ReturnType<typeof listTaskPresets>>);
  vi.mocked(addScheduleTask).mockResolvedValue(schedule);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '태스크 2 수정' }));
  fireEvent.change(screen.getByLabelText('태스크 이름'), { target: { value: '수정된 태스크' } });
  fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
  await waitFor(() => expect(updateTask).toHaveBeenCalledWith('2', { name: '수정된 태스크' }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.queryByText(/^(메모를 저장했습니다\.|저장했습니다\.|자동 저장)$/),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '수정된 태스크 수정' }));
  fireEvent.click(screen.getByRole('button', { name: '저장된 워크' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 태스크 추가' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '추가할' },
  });
  fireEvent.click(await screen.findByRole('option', { name: '추가할 태스크' }));
  await waitFor(() => expect(addScheduleTask).toHaveBeenCalledWith('s', 'preset'));
  await waitFor(() => expect(screen.getByRole('button', { name: '+ 태스크 추가' })).toBeVisible());
});

it('keeps yesterday edits through rollover and failed save, then loads today after closing', async () => {
  vi.mocked(getDaySchedules).mockResolvedValueOnce([schedule]).mockResolvedValue([]);
  vi.mocked(updateTask)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValue({
      ...schedule,
      tasks: schedule.tasks.map((task) =>
        task.id === '2' ? { ...task, execution_notes: '자정 메모' } : task,
      ),
    });
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '태스크 2 수정' }));
  fireEvent.change(screen.getByLabelText('실행 메모'), { target: { value: '자정 메모' } });
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" />);
  expect(screen.getByLabelText('실행 메모')).toHaveValue('자정 메모');
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/날짜가 바뀌었습니다/)).toBeVisible();
  fireEvent.blur(screen.getByLabelText('실행 메모'));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText('실행 메모')).toHaveValue('자정 메모');
  fireEvent.blur(screen.getByLabelText('실행 메모'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.queryByText(/^(메모를 저장했습니다\.|저장했습니다\.|자동 저장)$/),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '메모 저장' })).not.toBeInTheDocument();
  expect(updateTask).toHaveBeenLastCalledWith('2', { execution_notes: '자정 메모' });
  fireEvent.click(screen.getByRole('button', { name: '태스크 2 수정' }));
  await screen.findByText('오늘 저장된 스케줄이 없습니다.');
  expect(getDaySchedules).toHaveBeenLastCalledWith('2026-09-25', expect.any(AbortSignal));
  expect(screen.queryByText(/날짜가 바뀌었습니다/)).not.toBeInTheDocument();
});

it('waits for a pending mutation at rollover then fetches the new day immediately', async () => {
  let resolve!: (value: ScheduleDetail) => void;
  vi.mocked(completeSchedule).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.mocked(getDaySchedules).mockResolvedValueOnce([schedule]).mockResolvedValue([]);
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크 모든 태스크 완료' }));
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" />);
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '저장된 워크' })).toBeVisible();
  await act(async () => {
    resolve({ ...schedule, status: 'completed' });
  });
  await screen.findByText('오늘 저장된 스케줄이 없습니다.');
  expect(getDaySchedules).toHaveBeenLastCalledWith('2026-09-25', expect.any(AbortSignal));
});

it('keeps the task picker across rollover and switches days after adding', async () => {
  vi.mocked(getDaySchedules).mockResolvedValueOnce([schedule]).mockResolvedValue([]);
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [{ id: 'preset', name: '추가할 태스크' }],
    total: 1,
    offset: 0,
    limit: 20,
  } as Awaited<ReturnType<typeof listTaskPresets>>);
  vi.mocked(addScheduleTask).mockResolvedValue(schedule);
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 태스크 추가' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '추가할' },
  });
  await screen.findByRole('option', { name: '추가할 태스크' });
  view.rerender(<Today today="2026-09-25" timeZone="Asia/Tokyo" />);
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('option', { name: '추가할 태스크' }));
  await screen.findByText('오늘 저장된 스케줄이 없습니다.');
  expect(addScheduleTask).toHaveBeenCalledWith('s', 'preset');
  expect(getDaySchedules).toHaveBeenLastCalledWith('2026-09-25', expect.any(AbortSignal));
});

it('refreshes the summary arc immediately after a schedule write', async () => {
  const first = { ...schedule, scheduled_date: '2026-09-24', end_date: '2026-09-24', tasks: [] };
  vi.mocked(getDaySchedules).mockResolvedValue([first]);
  const view = render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  await screen.findByRole('article', { name: '저장된 워크' });
  const arc = () => view.container.querySelector('.today-work-arc circle')!;
  const before = arc().getAttribute('stroke-dashoffset');
  vi.mocked(getDaySchedules).mockResolvedValue([
    { ...first, start_time: '13:00', end_time: '15:00' },
  ]);
  act(() => window.dispatchEvent(new Event('schedules-changed')));
  await waitFor(() => expect(arc().getAttribute('stroke-dashoffset')).not.toBe(before));
  expect(arc().closest('.today-work-arc')).toHaveTextContent('13:00');
});

it('deletes only the selected schedule or task after confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(deleteScheduleTask).mockResolvedValue({ ...schedule, tasks: schedule.tasks.slice(1) });
  vi.mocked(deleteSchedule).mockResolvedValue(undefined);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  await screen.findByRole('article', { name: '저장된 워크' });
  fireEvent.click(screen.getByRole('button', { name: '태스크 0 삭제' }));
  await waitFor(() => expect(screen.queryByText('태스크 0')).not.toBeInTheDocument());
  expect(deleteScheduleTask).toHaveBeenCalledWith('0');
  fireEvent.click(screen.getByRole('button', { name: '저장된 워크 삭제' }));
  await waitFor(() =>
    expect(screen.queryByRole('article', { name: '저장된 워크' })).not.toBeInTheDocument(),
  );
  expect(deleteSchedule).toHaveBeenCalledWith('s');
  confirm.mockRestore();
});

it('shows a single-line schedule memo and places time beside the work name', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([
    { ...schedule, notes: '  첫 줄\n\r\n  다음\t줄  ' },
  ]);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  const card = await screen.findByRole('article', { name: '저장된 워크' });
  expect(card.querySelector('.schedule-card-memo')?.textContent).toBe('첫 줄 다음 줄');
  expect(within(card).getByRole('heading', { name: /저장된 워크/ })).toHaveTextContent(
    '09:00 — 10:00',
  );
  expect(within(card).getAllByRole('link', { name: '스케줄 수정' })).toHaveLength(1);
});

it('retains a parameterized task draft after failure and uses the shared directory', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
  vi.mocked(addScheduleTask)
    .mockRejectedValueOnce(new Error('추가 실패'))
    .mockResolvedValue(schedule);
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크' }));
  fireEvent.click(screen.getByRole('button', { name: '+ 태스크 추가' }));
  expect(screen.getByRole('button', { name: '태스크 목록' })).toBeVisible();
  const input = screen.getByRole('combobox', { name: '태스크 이름' });
  fireEvent.change(input, { target: { value: '연습 [n]번' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(addScheduleTask).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '이 값으로 추가' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('n'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: '이 값으로 추가' }));
  await screen.findByText('추가 실패');
  expect(input).toHaveValue('연습 [n]번');
  expect(screen.getByLabelText('n')).toHaveValue('5');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '+ 태스크 추가' })).toBeVisible());
  expect(addScheduleTask).toHaveBeenLastCalledWith('s', 'name:연습 [n]번', {
    parameters: { n: '5' },
  });
});

it('reveals task addition on hover or keyboard focus without selecting the card', async () => {
  vi.mocked(getDaySchedules).mockResolvedValue([schedule]);
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  render(<Today today="2026-09-24" timeZone="Asia/Tokyo" />);
  const card = await screen.findByRole('article', { name: '저장된 워크' });
  fireEvent.mouseEnter(card);
  expect(within(card).getByRole('button', { name: '+ 태스크 추가' })).toBeVisible();
  expect(card).toHaveAttribute('data-selected', 'false');
  fireEvent.mouseLeave(card);
  expect(within(card).queryByRole('button', { name: '+ 태스크 추가' })).not.toBeInTheDocument();
  const title = within(card).getByRole('button', { name: '저장된 워크' });
  fireEvent.focus(title);
  expect(within(card).getByRole('button', { name: '+ 태스크 추가' })).toBeVisible();
  fireEvent.blur(title, { relatedTarget: document.body });
  fireEvent.mouseEnter(card);
  fireEvent.click(within(card).getByRole('button', { name: '+ 태스크 추가' }));
  fireEvent.mouseLeave(card);
  expect(within(card).getByRole('button', { name: '추가 닫기' })).toBeVisible();
});

it('applies completion responses to the dial without reloading schedules', async () => {
  const future = { ...schedule, scheduled_date: '2099-09-24', end_date: '2099-09-24', tasks: [] };
  vi.mocked(getDaySchedules).mockResolvedValue([future]);
  vi.mocked(completeSchedule).mockImplementation(async () => {
    window.dispatchEvent(new Event('schedules-changed'));
    return { ...future, status: 'completed' };
  });
  vi.mocked(reopenSchedule).mockResolvedValue(future);
  const view = render(<Today today="2099-09-24" timeZone="Asia/Tokyo" />);
  fireEvent.click(await screen.findByRole('button', { name: '저장된 워크 모든 태스크 완료' }));
  await waitFor(() =>
    expect(view.container.querySelector('.today-work-arc')).toHaveAttribute(
      'data-state',
      'completed',
    ),
  );
  fireEvent.click(screen.getByRole('checkbox', { name: '저장된 워크 완료 취소' }));
  await waitFor(() =>
    expect(view.container.querySelector('.today-work-arc')).toHaveAttribute(
      'data-state',
      'upcoming',
    ),
  );
  expect(getDaySchedules).toHaveBeenCalledTimes(1);
});
