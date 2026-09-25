import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScheduleEditor, ScheduleView } from './Schedules';
import { listWorks, emptyFields } from '../../api/works';
import { listTaskPresets } from '../../api/taskPresets';
import { getWorkTasks } from '../../api/workTasks';
import { getSchedule, saveSchedule, type ScheduleDetail } from '../../api/schedules';
vi.mock('../../api/works', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/works')>()),
  listWorks: vi.fn(),
}));
vi.mock('../../api/taskPresets');
vi.mock('../../api/workTasks');
vi.mock('../../api/schedules');
const saved: ScheduleDetail = {
  id: 's',
  entity_id: 'w',
  title: 'Work',
  scheduled_date: '2026-09-24',
  end_date: '2026-09-24',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'pending',
  created_at: '',
  updated_at: '',
  entity_snapshot: { ...emptyFields, name: 'Old Work' },
  tasks: [],
};
beforeEach(() => {
  window.location.hash = '/schedules/new';
  vi.mocked(listWorks).mockResolvedValue({
    items: [{ ...emptyFields, id: 'w', name: 'Work', created_at: '', updated_at: '' }],
    total: 1,
    limit: 20,
    offset: 0,
  });
  vi.mocked(listTaskPresets).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
});
afterEach(() => vi.resetAllMocks());
it('loads and saves the independent schedule color with no snapshot changes', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={{ ...saved, color: 'red' }} />);
  expect(screen.getByRole('radio', { name: '빨강' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: '파랑' }));
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(expect.objectContaining({ color: 'blue' }), 's'),
  );
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('entity_snapshot');
});
it('saves the schedule work memo inline and preserves a failed draft', async () => {
  vi.mocked(getSchedule).mockResolvedValue(saved);
  vi.mocked(saveSchedule)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce({ ...saved, notes: '오늘 집중이 잘 됐다' });
  render(<ScheduleView id="s" edit={false} />);
  fireEvent.change(await screen.findByLabelText('워크 메모'), {
    target: { value: '오늘 집중이 잘 됐다' },
  });
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText('워크 메모')).toHaveValue('오늘 집중이 잘 됐다');
  fireEvent.blur(screen.getByLabelText('워크 메모'));
  expect(await screen.findByText('메모를 저장했습니다.')).toBeVisible();
  expect(saveSchedule).toHaveBeenLastCalledWith({ notes: '오늘 집중이 잘 됐다' }, 's');
  expect(screen.getByLabelText('워크 메모')).toHaveValue('오늘 집중이 잘 됐다');
});
it('composes per-task parameter values and notes without changing the source preset', async () => {
  vi.mocked(getWorkTasks).mockResolvedValue([
    { id: 't', name: '단어 [n=5]개 외우기', archived: false, position: 0 },
  ]);
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  expect(await screen.findByLabelText('n')).toHaveValue('5');
  fireEvent.change(screen.getByLabelText('n'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: '단어 [n=5]개 외우기 메모' }));
  fireEvent.change(screen.getByLabelText('메모'), { target: { value: '예문도 기록' } });
  fireEvent.click(screen.getByRole('button', { name: '메모 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(saveSchedule).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        task_preset_ids: ['t'],
        task_customizations: { t: { parameters: { n: '10' }, execution_notes: '예문도 기록' } },
      }),
      undefined,
    ),
  );
});
it('selects active defaults, reorders and preserves form on failed save', async () => {
  vi.mocked(getWorkTasks).mockResolvedValue([
    { id: 'a', name: 'A', archived: false, position: 0 },
    { id: 'b', name: 'B', archived: false, position: 1 },
    { id: 'c', name: 'Archived', archived: true, position: 2 },
  ]);
  vi.mocked(saveSchedule)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(saved);
  render(<ScheduleEditor />);
  expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeDisabled();
  fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  fireEvent.click(await screen.findByRole('button', { name: 'B 위로' }));
  expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/스케줄 메모/), { target: { value: 'keep' } });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText(/스케줄 메모/)).toHaveValue('keep');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity_id: 'w',
        title: 'Work',
        task_preset_ids: ['b', 'a'],
        notes: 'keep',
      }),
      undefined,
    ),
  );
  await waitFor(() => expect(window.location.hash).toBe('#/schedules/s'));
});
it('failed default fetch blocks save and can be retried', async () => {
  vi.mocked(getWorkTasks).mockRejectedValueOnce(new Error('기본값 실패')).mockResolvedValueOnce([]);
  render(<ScheduleEditor />);
  fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  expect(await screen.findByText('기본값 실패')).toBeVisible();
  expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeEnabled());
});
it('rejects reversed times without sending edits and preserves snapshot fields', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={saved} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '2026-09-23' } });
  fireEvent.change(screen.getByLabelText('종료 시간', { selector: 'input' }), {
    target: { value: '08:00' },
  });
  fireEvent.submit(screen.getByRole('button', { name: '스케줄 저장' }).closest('form')!);
  expect(await screen.findByText('종료 날짜와 시간은 시작보다 늦어야 합니다.')).toBeVisible();
  expect(saveSchedule).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '2026-09-25' } });
  fireEvent.change(screen.getByLabelText('종료 시간', { selector: 'input' }), {
    target: { value: '11:00' },
  });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() => expect(saveSchedule).toHaveBeenCalled());
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('entity_id');
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('task_preset_ids');
});
it('renders saved work snapshot without archive controls', async () => {
  vi.mocked(getSchedule).mockResolvedValue(saved);
  render(<ScheduleView id="s" edit={false} />);
  expect(await screen.findByRole('heading', { name: 'Old Work' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '스케줄 보관' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '스케줄 복원' })).not.toBeInTheDocument();
});

it('uses the app zone without a zone input and saves an overnight date range', async () => {
  vi.mocked(getWorkTasks).mockResolvedValue([]);
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor timeZone="Pacific/Honolulu" />);
  expect(screen.queryByLabelText('시간대')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeEnabled());
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  expect(screen.getAllByRole('slider')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-12-31' } });
  fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '2027-01-02' } });
  fireEvent.change(screen.getByLabelText('시작 시간', { selector: 'input' }), {
    target: { value: '23:30' },
  });
  fireEvent.change(screen.getByLabelText('종료 시간', { selector: 'input' }), {
    target: { value: '01:05' },
  });
  fireEvent.click(screen.getByRole('button', { name: /스케줄 저장/ }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_date: '2026-12-31',
        end_date: '2027-01-02',
        start_time: '23:30',
        end_time: '01:05',
        time_zone: 'Pacific/Honolulu',
      }),
      undefined,
    ),
  );
});
it('returning from multiple days restores the dial and a valid same-day interval', () => {
  render(
    <ScheduleEditor
      initial={{ ...saved, end_date: '2026-09-25', start_time: '23:00', end_time: '01:00' }}
    />,
  );
  expect(screen.getByLabelText('종료 날짜')).toHaveValue('2026-09-25');
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  expect(screen.queryByLabelText('종료 날짜')).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(2);
});

it('ordinary edits have no archive field', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={saved} />);
  fireEvent.change(screen.getByLabelText(/스케줄 메모/), { target: { value: 'notes only' } });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() => expect(saveSchedule).toHaveBeenCalled());
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('archived');
});

it('hides work results until searched and shows why a non-name result matched', async () => {
  vi.mocked(listWorks).mockResolvedValue({
    items: [
      {
        ...emptyFields,
        id: 'memo-work',
        name: 'Research',
        general_notes: 'Meet at the library',
        custom_fields: [{ name: 'Floor', value: 'Basement' }],
        created_at: '',
        updated_at: '',
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
  });
  vi.mocked(getWorkTasks).mockResolvedValue([]);
  render(<ScheduleEditor />);
  expect(screen.queryByLabelText('스케줄 제목')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Research 선택' })).not.toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(listWorks).not.toHaveBeenCalled();
  const search = screen.getByRole('searchbox', { name: '워크 검색' });
  fireEvent.change(search, { target: { value: 'library' } });
  expect(await screen.findByText('메모: Meet at the library')).toBeVisible();
  fireEvent.change(search, { target: { value: '' } });
  expect(screen.queryByRole('button', { name: 'Research 선택' })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'Basement' } });
  expect(await screen.findByText('Floor: Basement')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Research 선택' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeEnabled());
  expect(screen.getByText('Research')).toBeVisible();
});

it('flips to task groups, adds and removes tasks while retaining the time range', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(['학습'])));
  vi.mocked(getWorkTasks).mockResolvedValue([]);
  vi.mocked(listTaskPresets).mockResolvedValue({
    items: [
      {
        id: 'a',
        name: '단어 복습',
        group_name: '학습',
        default_notes: '',
        tags: [],
        archived: false,
        version: 1,
        created_at: '',
        updated_at: '',
        item_count: 0,
      },
    ],
    total: 1,
    offset: 0,
    limit: 20,
  });
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  fireEvent.change(screen.getByRole('searchbox', { name: '워크 검색' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  fireEvent.click(await screen.findByRole('button', { name: '태스크' }));
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: '학습' }));
  fireEvent.click(await screen.findByRole('button', { name: '단어 복습 추가' }));
  expect(screen.getByRole('button', { name: '단어 복습 추가됨' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '단어 복습 제거' }));
  expect(screen.getByRole('button', { name: '단어 복습 추가' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '단어 복습 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '시계판으로' }));
  expect(screen.getByRole('slider', { name: '시작 시간' })).toHaveAttribute('aria-valuenow', '540');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ task_preset_ids: ['a'], start_time: '09:00', end_time: '10:00' }),
      undefined,
    ),
  );
});

it('saves custom reminder units and restores them while editing', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(
    <ScheduleEditor
      initial={{ ...saved, reminder_enabled: true, reminder_value: 1, reminder_unit: 'hours' }}
    />,
  );
  expect(screen.getByRole('checkbox', { name: '리마인드' })).toBeChecked();
  expect(screen.getByRole('spinbutton', { name: '리마인드 숫자' })).toHaveValue(1);
  expect(screen.getByRole('combobox', { name: '리마인드 단위' })).toHaveValue('hours');
  fireEvent.change(screen.getByRole('spinbutton', { name: '리마인드 숫자' }), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: '리마인드 단위' }), {
    target: { value: 'days' },
  });
  fireEvent.click(screen.getByRole('button', { name: /스케줄 저장/ }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_enabled: true, reminder_value: 2, reminder_unit: 'days' }),
      's',
    ),
  );
});

it('hides dates for single-day editing and restores them only while multi-day is checked', () => {
  render(<ScheduleEditor initial={saved} />);
  expect(screen.queryByLabelText('시작 날짜')).not.toBeInTheDocument();
  expect(screen.queryByText(saved.scheduled_date)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('여러 날에 걸친 스케줄'));
  expect(screen.getByLabelText('시작 날짜')).toHaveValue(saved.scheduled_date);
  expect(screen.getByLabelText('종료 날짜')).toHaveValue('2026-09-25');
  fireEvent.click(screen.getByLabelText('여러 날에 걸친 스케줄'));
  expect(screen.queryByLabelText('시작 날짜')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('종료 날짜')).not.toBeInTheDocument();
});

it('makes legacy midnight ends editable without saving them automatically', () => {
  render(<ScheduleEditor initial={{ ...saved, end_date: '2026-09-25', end_time: '00:00' }} />);
  expect(screen.getByLabelText('종료 시간', { selector: 'input' })).toHaveValue('00:05');
  expect(saveSchedule).not.toHaveBeenCalled();
});
