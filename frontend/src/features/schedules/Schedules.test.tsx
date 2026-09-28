import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScheduleEditor, ScheduleView } from './Schedules';
import { listWorks, emptyFields } from '../../api/works';
import { listTaskPresets } from '../../api/taskPresets';
import {
  getSchedule,
  saveSchedule,
  completeSchedule,
  reopenSchedule,
  type ScheduleDetail,
} from '../../api/schedules';
vi.mock('../../api/works', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/works')>()),
  listWorks: vi.fn(),
}));
vi.mock('../../api/taskPresets');
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
it('starts without a time range and accepts the typed work without a use action', async () => {
  render(<ScheduleEditor />);
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  expect(screen.getByRole('button', { name: '시작 시간' })).toBeVisible();
  expect(screen.queryByRole('slider', { name: '종료 시간' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: '직접 입력' },
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '', end_time: '' }),
      undefined,
    ),
  );
  expect(screen.queryByRole('button', { name: /사용/ })).not.toBeInTheDocument();
});

function setTestTimes() {
  // New schedules deliberately have no defaults; select the test's 09:00–10:00 range.
  const start = screen.getByRole('slider', { name: '시작 시간', hidden: true });
  for (let i = 0; i < 9; i++) fireEvent.keyDown(start, { key: 'PageUp' });
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간', hidden: true }), {
    key: 'PageUp',
  });
}
function pickTime(label: string, time: string) {
  const picker = screen.getByRole('button', { name: label, hidden: true });
  fireEvent.click(picker.closest('.time-endpoint-box')!.querySelector('.time-endpoint-value')!);
  fireEvent.click(screen.getByRole('button', { name: label }));
  const [hour, minute] = time.split(':');
  fireEvent.click(
    within(screen.getByRole('listbox', { name: '시' })).getByRole('option', { name: hour }),
  );
  fireEvent.click(
    within(screen.getByRole('listbox', { name: '분' })).getByRole('option', { name: minute }),
  );
  fireEvent.click(screen.getByRole('button', { name: '적용' }));
}
async function pickDate(label: string, date: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  const popup = screen.getByRole('dialog', { name: '날짜 선택' });
  const selected = popup.querySelector('[aria-pressed="true"]')!.getAttribute('data-date')!;
  const monthNumber = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  const delta = monthNumber(date) - monthNumber(selected);
  for (let i = 0; i < Math.abs(delta); i++)
    fireEvent.click(within(popup).getByRole('button', { name: delta > 0 ? '다음 달' : '이전 달' }));
  fireEvent.click(popup.querySelector('[data-date="' + date + '"]')!);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '날짜 선택' })).not.toBeInTheDocument(),
  );
}

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
  render(<ScheduleView id="s" edit={false} onClose={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('메모'), {
    target: { value: '오늘 집중이 잘 됐다' },
  });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText('메모')).toHaveValue('오늘 집중이 잘 됐다');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() => expect(saveSchedule).toHaveBeenCalledTimes(2));
  expect(saveSchedule).toHaveBeenLastCalledWith(
    expect.objectContaining({ notes: '오늘 집중이 잘 됐다' }),
    's',
  );
  expect(screen.getByLabelText('메모')).toHaveValue('오늘 집중이 잘 됐다');
});
it('composes per-task parameter values and notes without changing the source preset', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '단어 [n=5]개 외우기' },
  });
  expect(await screen.findByLabelText('n')).toHaveValue('5');
  fireEvent.change(screen.getByLabelText('n'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: '단어 [n=5]개 외우기 메모' }));
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('메모'), {
    target: { value: '예문도 기록' },
  });
  fireEvent.click(screen.getByRole('button', { name: '메모 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(saveSchedule).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        task_preset_ids: ['name:단어 [n=5]개 외우기'],
        task_customizations: {
          'name:단어 [n=5]개 외우기': { parameters: { n: '10' }, execution_notes: '예문도 기록' },
        },
      }),
      undefined,
    ),
  );
});
it('adds manual tasks, reorders and preserves form on failed save', async () => {
  vi.mocked(saveSchedule)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  for (const name of ['A', 'B']) {
    fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: '태스크 이름' }).at(-1)!, {
      target: { value: name },
    });
  }
  fireEvent.click(await screen.findByRole('button', { name: 'B 위로' }));
  expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^메모$/), { target: { value: 'keep' } });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText(/^메모$/)).toHaveValue('keep');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entity_id: 'w',
        title: 'Work',
        task_preset_ids: ['name:B', 'name:A'],
        notes: 'keep',
      }),
      undefined,
    ),
  );
  await waitFor(() => expect(window.location.hash).toBe('#/schedules/s'));
});
it('choosing a work never adds tasks automatically', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  expect(screen.queryByRole('combobox', { name: '태스크 이름' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ task_preset_ids: [] }),
      undefined,
    ),
  );
});
it('swaps reversed dates and preserves snapshot fields', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={saved} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  await pickDate('종료 날짜', '2026-09-23');
  pickTime('종료 시간', '08:00');
  fireEvent.submit(screen.getByRole('button', { name: '스케줄 저장' }).closest('form')!);
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_date: '2026-09-23',
        end_date: '2026-09-24',
        end_time: '08:00',
      }),
      's',
    ),
  );
  await waitFor(() => expect(saveSchedule).toHaveBeenCalled());
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('entity_id');
  expect(vi.mocked(saveSchedule).mock.calls[0]![0]).not.toHaveProperty('task_preset_ids');
});
it('renders saved work snapshot without archive controls', async () => {
  vi.mocked(getSchedule).mockResolvedValue(saved);
  render(<ScheduleView id="s" edit={false} />);
  expect(await screen.findByText('Old Work')).toBeVisible();
  const composition = document.querySelector('.schedule-compose')!;
  expect(composition).toContainElement(screen.getByRole('region', { name: '태스크 실행' }));
  expect(composition).toContainElement(screen.getByLabelText('메모'));
  expect(document.querySelector('form form')).toBeNull();
  expect(screen.queryByRole('button', { name: '스케줄 보관' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '스케줄 복원' })).not.toBeInTheDocument();
});

it('uses the app zone without a zone input and saves an overnight date range', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor timeZone="Pacific/Honolulu" />);
  expect(screen.queryByLabelText('시간대')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '스케줄 저장' })).toBeEnabled());
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  expect(screen.queryByTestId('time-dial')).not.toBeInTheDocument();
  await pickDate('종료 날짜', '2027-01-02');
  await pickDate('시작 날짜', '2026-12-31');
  pickTime('시작 시간', '23:30');
  pickTime('종료 시간', '01:05');
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
it('returning from multiple days preserves a valid overnight range', () => {
  render(
    <ScheduleEditor
      initial={{ ...saved, end_date: '2026-09-26', start_time: '23:00', end_time: '01:00' }}
    />,
  );
  expect(screen.queryByTestId('time-dial')).not.toBeInTheDocument();
  expect(screen.getByLabelText('종료 날짜')).toHaveTextContent('2026-09-26');
  fireEvent.click(screen.getByRole('checkbox', { name: /여러 날에 걸친 스케줄/ }));
  expect(screen.queryByLabelText('종료 날짜')).not.toBeInTheDocument();
  expect(screen.getAllByRole('slider')).toHaveLength(2);
});

it('ordinary edits have no archive field', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={saved} />);
  fireEvent.change(screen.getByLabelText(/^메모$/), { target: { value: 'notes only' } });
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
  render(<ScheduleEditor />);
  setTestTimes();
  expect(screen.queryByLabelText('스케줄 제목')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Research 선택' })).not.toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(listWorks).not.toHaveBeenCalled();
  const search = screen.getByRole('textbox', { name: '워크 이름' });
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

it('adds editable task rows with matching dropdowns while retaining the time range', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(['학습'])));
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
  setTestTimes();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  fireEvent.click(await screen.findByRole('button', { name: '태스크 추가...' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '단어' },
  });
  fireEvent.click(await screen.findByRole('option', { name: '단어 복습' }));
  expect(screen.getByRole('combobox', { name: '태스크 이름' })).toHaveValue('단어 복습');
  fireEvent.click(screen.getByRole('button', { name: '단어 복습 제거' }));
  expect(screen.queryByRole('combobox', { name: '태스크 이름' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '단어' },
  });
  fireEvent.click(await screen.findByRole('option', { name: '단어 복습' }));
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
  fireEvent.click(screen.getByRole('combobox', { name: '리마인드 단위' }));
  fireEvent.click(screen.getByRole('option', { name: '일' }));
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
  expect(screen.getByLabelText('시작 날짜')).toHaveTextContent(saved.scheduled_date);
  expect(screen.queryByTestId('time-dial')).not.toBeInTheDocument();
  expect(screen.getByLabelText('종료 날짜')).toHaveTextContent('2026-09-25');
  fireEvent.click(screen.getByLabelText('여러 날에 걸친 스케줄'));
  expect(screen.queryByLabelText('시작 날짜')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('종료 날짜')).not.toBeInTheDocument();
});

it('reopens midnight ends on the clock without changing their value', () => {
  render(<ScheduleEditor initial={{ ...saved, end_date: '2026-09-25', end_time: '00:00' }} />);
  expect(screen.getByRole('slider', { name: '종료 시간' })).toHaveAttribute(
    'aria-valuetext',
    '00:00',
  );
  expect(saveSchedule).not.toHaveBeenCalled();
});

it('saves a directly entered work and task and preserves the draft after failure', async () => {
  vi.mocked(saveSchedule)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: '새 워크' },
  });
  expect(screen.queryByRole('button', { name: '“새 워크” 사용' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('textbox', { name: '메모' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '새 워크 메모' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '워크 이름' })).toHaveValue('새 워크');
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '새 태스크' },
  });
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByRole('textbox', { name: '워크 이름' })).toHaveValue('새 워크');
  expect(screen.getByRole('combobox', { name: '태스크 이름' })).toHaveValue('새 태스크');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() => expect(saveSchedule).toHaveBeenCalledTimes(2));
  expect(saveSchedule).toHaveBeenLastCalledWith(
    expect.objectContaining({ entity_id: 'name:새 워크', task_preset_ids: ['name:새 태스크'] }),
    undefined,
  );
});

it('keeps mobile work and time drafts when the clock is collapsed', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 700px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  try {
    render(<ScheduleEditor />);
    setTestTimes();
    const name = screen.getByRole('textbox', { name: '워크 이름' });
    const disclosure = document.querySelector('.schedule-time-disclosure')!;
    expect(name).toBeVisible();
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(disclosure).toHaveAttribute('open');
    const time = screen.getByRole('slider', { name: '시작 시간' });
    fireEvent.keyDown(time, { key: 'ArrowRight' });
    fireEvent.change(name, { target: { value: '편집 중 워크' } });
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(disclosure.querySelector('summary')!);
    expect(time).toHaveAttribute('aria-valuenow', '545');
    expect(name).toHaveValue('편집 중 워크');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('places completion beside the work title and keeps only delete/save in the footer', async () => {
  vi.mocked(getSchedule).mockResolvedValue(saved);
  vi.mocked(completeSchedule).mockResolvedValue({ ...saved, status: 'completed' });
  vi.mocked(reopenSchedule).mockResolvedValue(saved);
  render(<ScheduleView id="s" modal onClose={vi.fn()} />);
  const completion = await screen.findByRole('checkbox', { name: '스케줄 완료' });
  expect(completion.closest('.schedule-work-title')).toHaveTextContent('Old Work');
  expect(screen.queryByRole('button', { name: '스케줄 취소' })).not.toBeInTheDocument();
  const footer = document.querySelector('.schedule-save')!;
  expect(footer.querySelectorAll('button')).toHaveLength(2);
  fireEvent.click(completion);
  await waitFor(() => expect(completion).toBeChecked());
  fireEvent.click(completion);
  await waitFor(() => expect(reopenSchedule).toHaveBeenCalledWith('s'));
});

it('preserves manual parameter and memo drafts after choosing another work', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
  fireEvent.change(screen.getByRole('combobox', { name: '태스크 이름' }), {
    target: { value: '읽기 [n=5]' },
  });
  fireEvent.change(screen.getByLabelText('n'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: '읽기 [n=5] 메모' }));
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('메모'), {
    target: { value: '보존할 메모' },
  });
  fireEvent.click(screen.getByRole('button', { name: '메모 닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: 'Work' },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Work 선택' }));
  expect(await screen.findByLabelText('n')).toHaveValue('12');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        task_preset_ids: ['name:읽기 [n=5]'],
        task_customizations: {
          'name:읽기 [n=5]': { parameters: { n: '12' }, execution_notes: '보존할 메모' },
        },
      }),
      undefined,
    ),
  );
});

it('blocks duplicate task rows without losing either row and saves after removal', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor />);
  setTestTimes();
  fireEvent.change(screen.getByRole('textbox', { name: '워크 이름' }), {
    target: { value: '새 워크' },
  });
  expect(screen.queryByRole('button', { name: '“새 워크” 사용' })).not.toBeInTheDocument();
  for (let index = 0; index < 2; index++) {
    fireEvent.click(screen.getByRole('button', { name: '태스크 추가...' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: '태스크 이름' })[index]!, {
      target: { value: '읽기' },
    });
  }
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('중복 행');
  expect(saveSchedule).not.toHaveBeenCalled();
  expect(screen.getAllByRole('combobox', { name: '태스크 이름' })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: '읽기 제거' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ task_preset_ids: ['name:읽기'] }),
      undefined,
    ),
  );
});

it('saves a clock range across the year boundary without enabling multi-day mode', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(
    <ScheduleEditor
      initial={{
        ...saved,
        scheduled_date: '2026-12-31',
        end_date: '2026-12-31',
        start_time: '23:00',
        end_time: '23:55',
      }}
    />,
  );
  fireEvent.keyDown(screen.getByRole('slider', { name: '종료 시간' }), { key: 'ArrowRight' });
  expect(screen.getByRole('checkbox', { name: '여러 날에 걸친 스케줄' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_date: '2026-12-31',
        end_date: '2027-01-01',
        start_time: '23:00',
        end_time: '00:00',
      }),
      's',
    ),
  );
});

it('groups each multi-day endpoint and swaps a start date later than the end', async () => {
  render(<ScheduleEditor initial={{ ...saved, end_date: '2026-09-26' }} />);
  expect(
    within(screen.getByRole('group', { name: '시작' })).getByRole('button', { name: '시작 시간' }),
  ).toBeVisible();
  expect(
    within(screen.getByRole('group', { name: '종료' })).getByRole('button', { name: '종료 날짜' }),
  ).toBeVisible();
  await pickDate('시작 날짜', '2026-09-28');
  expect(screen.getByRole('button', { name: '시작 날짜' })).toHaveTextContent('2026-09-26');
  expect(screen.getByRole('button', { name: '종료 날짜' })).toHaveTextContent('2026-09-28');
});

it('saves a start-only schedule and keeps reminders tied to a start time', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(<ScheduleEditor initial={{ ...saved, start_time: '', end_time: '' }} />);
  expect(screen.getByRole('checkbox', { name: /리마인드/ })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('slider', { name: '시작 시간' }), { key: 'PageUp' });
  expect(screen.getByRole('button', { name: '시작 시간' })).toBeVisible();
  expect(screen.getByRole('button', { name: '종료 시간' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: /리마인드/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '01:00', end_time: '' }),
      's',
    ),
  );
});

it('shows both multi-day time inputs immediately and allows selecting the end first', async () => {
  vi.mocked(saveSchedule).mockResolvedValue(saved);
  render(
    <ScheduleEditor initial={{ ...saved, end_date: '2026-09-26', start_time: '', end_time: '' }} />,
  );
  expect(
    within(screen.getByRole('group', { name: '시작' })).getByRole('button', { name: '시작 시간' }),
  ).toHaveTextContent('지정 없음');
  expect(
    within(screen.getByRole('group', { name: '종료' })).getByRole('button', { name: '종료 시간' }),
  ).toHaveTextContent('지정 없음');
  pickTime('종료 시간', '10:00');
  pickTime('시작 시간', '09:00');
  fireEvent.click(screen.getByRole('button', { name: '스케줄 저장' }));
  await waitFor(() =>
    expect(saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '09:00', end_time: '10:00', end_date: '2026-09-26' }),
      's',
    ),
  );
});
