import { useState } from 'react';
import type { TaskCustomization } from '../../api/schedules';
import { parametersValid } from '../shared/taskParameters';
import type { TaskChoice } from './TaskNameInput';

type TaskDraft = TaskChoice &
  TaskCustomization & {
    rowKey: string;
    source: 'manual';
  };

export function taskDraftError(rows: TaskDraft[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const row of rows.filter((row) => row.name.trim())) {
    if (ids.has(row.id) || names.has(row.name.trim())) return 'ScheduleEditor.duplicateTask';
    ids.add(row.id);
    names.add(row.name.trim());
    if (!parametersValid(row.name, row.parameters ?? {}))
      return 'ScheduleEditor.fillInTheTaskParametersTheCompletedNameCan';
  }
  return '';
}

export function taskDraftFields(rows: TaskDraft[]) {
  const selected = rows.filter((row) => row.name.trim());
  return {
    task_preset_ids: selected.map((row) => row.id),
    task_customizations: Object.fromEntries(
      selected.map(({ id, parameters, execution_notes }) => [
        id,
        {
          ...(parameters === undefined ? {} : { parameters }),
          ...(execution_notes === undefined ? {} : { execution_notes }),
        },
      ]),
    ),
  };
}

export function useScheduleTaskDraft() {
  const [work, setWork] = useState<TaskChoice>();
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  function choose(choice: TaskChoice) {
    setWork(choice);
  }

  function customize(rowKey: string, changes: TaskCustomization) {
    setTasks((rows) => rows.map((row) => (row.rowKey === rowKey ? { ...row, ...changes } : row)));
  }
  function rename(rowKey: string, choice: TaskChoice) {
    setTasks((rows) =>
      rows.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              ...choice,
              source: 'manual',
              ...(row.id === choice.id ? {} : { parameters: undefined }),
            }
          : row,
      ),
    );
  }
  function add() {
    setTasks((rows) =>
      rows.length >= 100
        ? rows
        : [
            ...rows,
            {
              id: 'draft:' + crypto.randomUUID(),
              name: '',
              rowKey: crypto.randomUUID(),
              source: 'manual',
            },
          ],
    );
  }
  function remove(rowKey: string) {
    setTasks((rows) => rows.filter((row) => row.rowKey !== rowKey));
  }
  function addMany(choices: TaskChoice[]) {
    setTasks((rows) => {
      const next = [...rows];
      for (const choice of choices) {
        if (next.length >= 100) break;
        if (next.some((row) => row.id === choice.id || row.name.trim() === choice.name.trim()))
          continue;
        next.push({ ...choice, rowKey: crypto.randomUUID(), source: 'manual' });
      }
      return next;
    });
  }
  function move(index: number, delta: number) {
    setTasks((rows) => {
      if (!rows[index] || !rows[index + delta]) return rows;
      const next = [...rows];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    });
  }
  return {
    work,
    tasks,
    choose,
    customize,
    rename,
    add,
    addMany,
    remove,
    move,
  };
}
