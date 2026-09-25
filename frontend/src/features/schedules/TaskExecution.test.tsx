import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskExecution } from './TaskExecution';
import { updateItem, updateTask, type ScheduleDetail } from '../../api/schedules';
import { emptyFields } from '../../api/works';
vi.mock('../../api/schedules');
afterEach(() => vi.resetAllMocks());
it('keeps template fields editable after creation and saves only this execution', async () => {
  const task = {
    ...schedule.tasks[0]!,
    name_snapshot: '단어 5개 외우기',
    name_template_snapshot: '단어 [n=5]개 외우기',
    parameter_values: { n: '5' },
  };
  const changed = {
    ...schedule,
    tasks: [{ ...task, name_snapshot: '단어 10개 외우기', parameter_values: { n: '10' } }],
  };
  vi.mocked(updateTask).mockResolvedValue(changed);
  const mutate = vi.fn(async (operation: () => Promise<ScheduleDetail>) => {
    await operation();
  });
  render(<TaskExecution task={task} locked={false} busy={false} mutate={mutate} allowRename />);
  fireEvent.change(screen.getByLabelText('n'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: '이름 저장' }));
  expect(await screen.findByText('저장했습니다.')).toBeVisible();
  expect(updateTask).toHaveBeenCalledWith('t', {
    name: '단어 [n=5]개 외우기',
    parameters: { n: '10' },
  });
});
const schedule: ScheduleDetail = {
  id: 's',
  entity_id: 'w',
  title: 'Work',
  scheduled_date: '2026-09-24',
  end_date: '2026-09-24',
  start_time: '09:00',
  end_time: '10:00',
  time_zone: 'Asia/Tokyo',
  notes: '',
  status: 'planned',
  created_at: '',
  updated_at: '',
  entity_snapshot: emptyFields,
  tasks: [
    {
      id: 't',
      name_snapshot: 'Task',
      default_notes_snapshot: 'Reference',
      source_task_preset_version: 1,
      status: 'pending',
      execution_notes: '',
      items: [
        {
          id: 'i',
          definition: {
            id: 'source',
            position: 0,
            label: '측정',
            item_type: 'number',
            required: true,
            default_value: null,
            unit: 'kg',
          },
          value_boolean: null,
          value_text: null,
          value_number: null,
          completed: false,
        },
        {
          id: 'text',
          definition: {
            id: 'src2',
            position: 1,
            label: '기록',
            item_type: 'text',
            required: true,
            default_value: null,
            unit: '',
          },
          value_boolean: null,
          value_text: null,
          value_number: null,
          completed: false,
        },
      ],
    },
  ],
};
function Harness({ locked = false }: { locked?: boolean }) {
  const [value, setValue] = useState(schedule);
  const [busy, setBusy] = useState(false);
  return (
    <TaskExecution
      task={value.tasks[0]!}
      locked={locked}
      busy={busy}
      mutate={async (op) => {
        setBusy(true);
        try {
          setValue(await op());
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
it('preserves all draft inputs after failure, saves fields independently, accepts zero and normalizes numeric draft', async () => {
  const numeric = {
    ...schedule,
    tasks: [
      {
        ...schedule.tasks[0]!,
        items: schedule.tasks[0]!.items.map((i) =>
          i.id === 'i' ? { ...i, value_number: 0, completed: true } : i,
        ),
      },
    ],
  };
  vi.mocked(updateItem)
    .mockRejectedValueOnce(new Error('저장 실패'))
    .mockResolvedValueOnce(numeric);
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('측정 · 필수 (kg)'), { target: { value: '0.00' } });
  fireEvent.change(screen.getByLabelText('기록 · 필수'), { target: { value: 'unsaved' } });
  expect(screen.getByRole('button', { name: '태스크 완료' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '측정 저장' }));
  expect(await screen.findByText('저장 실패')).toBeVisible();
  expect(screen.getByLabelText('측정 · 필수 (kg)')).toHaveValue(0);
  expect(screen.getByLabelText('기록 · 필수')).toHaveValue('unsaved');
  fireEvent.click(screen.getByRole('button', { name: '측정 저장' }));
  expect(await screen.findByText('저장했습니다.')).toBeVisible();
  expect(updateItem).toHaveBeenLastCalledWith('i', 0);
  expect(screen.getByRole('button', { name: '측정 저장' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '태스크 완료' })).toBeDisabled();
  expect(screen.getByLabelText('기록 · 필수')).toHaveValue('unsaved');
});
it('saves notes and retries rejected completion without inventing a completed state', async () => {
  const notes = { ...schedule, tasks: [{ ...schedule.tasks[0]!, execution_notes: 'memo' }] };
  vi.mocked(updateTask)
    .mockResolvedValueOnce(notes)
    .mockRejectedValueOnce(new Error('필수 항목을 모두 입력한 뒤 완료해 주세요.'))
    .mockResolvedValueOnce({
      ...notes,
      status: 'completed',
      tasks: [{ ...notes.tasks[0]!, status: 'completed' }],
    });
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('실행 메모'), { target: { value: 'memo' } });
  fireEvent.blur(screen.getByLabelText('실행 메모'));
  expect(await screen.findByText('메모를 저장했습니다.')).toBeVisible();
  expect(updateTask).toHaveBeenCalledWith('t', { execution_notes: 'memo' });
  fireEvent.click(screen.getByRole('button', { name: '태스크 완료' }));
  expect(await screen.findByText('필수 항목을 모두 입력한 뒤 완료해 주세요.')).toBeVisible();
  expect(screen.queryByRole('button', { name: '완료 취소' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '태스크 완료' }));
  expect(await screen.findByRole('button', { name: '완료 취소' })).toBeVisible();
});
it('locks execution controls for cancelled schedules', () => {
  render(<Harness locked />);
  for (const button of within(screen.getByRole('region', { name: 'Task 실행' })).getAllByRole(
    'button',
  ))
    expect(button).toBeDisabled();
});
