import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { taskDraftError, taskDraftFields, useScheduleTaskDraft } from './useScheduleTaskDraft';
it('choosing and changing work adds no tasks and preserves manual drafts', () => {
  const { result } = renderHook(useScheduleTaskDraft);
  act(() => result.current.choose({ id: 'w', name: 'Work' }));
  expect(result.current.tasks).toEqual([]);
  act(() => result.current.add());
  const key = result.current.tasks[0]!.rowKey;
  act(() => result.current.rename(key, { id: 't', name: 'Read [n=5]' }));
  act(() => result.current.customize(key, { parameters: { n: '12' }, execution_notes: 'keep' }));
  const before = result.current.tasks;
  act(() => result.current.choose({ id: 'another', name: 'Another' }));
  expect(result.current.tasks).toEqual(before);
  expect(taskDraftFields(result.current.tasks)).toEqual({
    task_preset_ids: ['t'],
    task_customizations: { t: { parameters: { n: '12' }, execution_notes: 'keep' } },
  });
});
it('keeps duplicate rows independent and requires resolution before serialization', () => {
  const { result } = renderHook(useScheduleTaskDraft);
  act(() => {
    result.current.add();
    result.current.add();
  });
  const [first, second] = result.current.tasks;
  act(() => {
    result.current.rename(first!.rowKey, { id: 't', name: 'Read [n=5]' });
    result.current.rename(second!.rowKey, { id: 't', name: 'Read [n=5]' });
    result.current.customize(first!.rowKey, { parameters: { n: '10' }, execution_notes: 'first' });
    result.current.customize(second!.rowKey, {
      parameters: { n: '20' },
      execution_notes: 'second',
    });
  });
  expect(taskDraftError(result.current.tasks)).toBe('ScheduleEditor.duplicateTask');
  act(() => result.current.remove(first!.rowKey));
  expect(taskDraftError(result.current.tasks)).toBe('');
  expect(taskDraftFields(result.current.tasks).task_customizations.t).toEqual({
    parameters: { n: '20' },
    execution_notes: 'second',
  });
});
