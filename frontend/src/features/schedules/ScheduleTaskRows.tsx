import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import {
  addScheduleTask,
  updateTask,
  type ScheduleDetail,
  type ScheduleTask,
} from '../../api/schedules';
import { Input, Button } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { TaskNameInput, type TaskChoice } from './TaskNameInput';
import { TaskDirectory } from './TaskDirectory';
import { TaskParameterInputs } from '../shared/TaskParameterInputs';
import { parameterDefaults, parametersValid, taskParameters } from '../shared/taskParameters';

type Mutation = (operation: () => Promise<ScheduleDetail>) => Promise<void>;

export function SavedTaskRow({
  task,
  disabled,
  mutate,
  onEdit,
}: {
  task: ScheduleTask;
  disabled: boolean;
  mutate: Mutation;
  onEdit: () => void;
}) {
  const [name, setName] = useState(task.name_template_snapshot ?? task.name_snapshot);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function rename(choice: TaskChoice) {
    if (choice.name === (task.name_template_snapshot ?? task.name_snapshot) || lock.current) return;
    lock.current = true;
    setError('');
    try {
      await mutate(() =>
        updateTask(task.id, {
          name: choice.name,
          parameters: {
            ...parameterDefaults(choice.name),
            ...Object.fromEntries(
              taskParameters(choice.name)
                .filter(({ key }) => task.parameter_values?.[key] !== undefined)
                .map(({ key }) => [key, task.parameter_values![key]!]),
            ),
          },
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
    }
  }
  return (
    <div>
      <div className="schedule-task-row">
        <Input
          type="checkbox"
          className="task-check"
          checked={task.status === 'completed'}
          disabled={disabled}
          aria-label={tr('SavedScheduleCard.completeValue', { v1: task.name_snapshot })}
          onChange={() => {
            setError('');
            void mutate(() =>
              updateTask(task.id, {
                status: task.status === 'completed' ? 'pending' : 'completed',
              }),
            ).catch((e) => setError(message(e)));
          }}
        />
        <TaskNameInput
          value={name}
          disabled={disabled}
          onChange={(choice) => setName(choice.name)}
          onCommit={(choice) => void rename(choice)}
        />
        <Button variant="ghost" onClick={onEdit}>
          {tr('ScheduleTasks.details')}
        </Button>
      </div>
      {error && <ErrorBox error={error} retry={() => void rename({ id: task.id, name })} />}
    </div>
  );
}

function NewTaskRow({
  scheduleId,
  disabled,
  mutate,
  onRemove,
  onAdded,
  initialChoice,
}: {
  scheduleId: string;
  disabled: boolean;
  mutate: Mutation;
  onRemove: () => void;
  onAdded: () => void;
  initialChoice?: TaskChoice;
}) {
  const [choice, setChoice] = useState<TaskChoice>(initialChoice ?? { id: '', name: '' });
  const [parameters, setParameters] = useState<Record<string, string>>(
    parameterDefaults(initialChoice?.name ?? ''),
  );
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function commit(next: TaskChoice) {
    if (!next.name.trim() || disabled || lock.current) return;
    if (taskParameters(next.name).length) return;
    await save(next);
  }
  async function save(next: TaskChoice) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    try {
      await mutate(() =>
        taskParameters(next.name).length
          ? addScheduleTask(scheduleId, next.id, { parameters })
          : addScheduleTask(scheduleId, next.id),
      );
      onAdded();
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
    }
  }
  return (
    <div>
      <div className="schedule-task-row">
        <Input
          type="checkbox"
          className="task-check"
          checked={false}
          disabled
          aria-label={tr('SavedScheduleCard.completeValue', { v1: choice.name })}
        />
        <TaskNameInput
          autoFocus={!initialChoice}
          value={choice.name}
          disabled={disabled}
          onChange={(next) => {
            setChoice(next);
            setParameters(parameterDefaults(next.name));
          }}
          onCommit={(next) => void commit(next)}
        />
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label={tr('ScheduleEditor.removeValue', { v1: choice.name })}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
        >
          <ActionIcon name="close" />
        </Button>
      </div>
      {(taskParameters(choice.name).length > 0 || initialChoice) && (
        <>
          <TaskParameterInputs
            template={choice.name}
            values={parameters}
            onChange={setParameters}
          />
          <Button
            variant="ghost"
            disabled={disabled || !parametersValid(choice.name, parameters)}
            onClick={() => void save(choice)}
          >
            {tr('AddTaskPicker.addWithTheseValues')}
          </Button>
        </>
      )}
      {error && <ErrorBox error={error} retry={() => void save(choice)} />}
    </div>
  );
}

export function NewTaskRows({
  scheduleId,
  disabled,
  mutate,
  existing = [],
  children,
  initialRow = false,
  onEmpty,
}: {
  scheduleId: string;
  disabled: boolean;
  mutate: Mutation;
  existing?: TaskChoice[];
  children?: ReactNode;
  initialRow?: boolean;
  onEmpty?: () => void;
}) {
  useTranslation();
  const [rows, setRows] = useState<{ key: string; choice?: TaskChoice }[]>(() =>
    initialRow ? [{ key: crypto.randomUUID() }] : [],
  );
  const [directory, setDirectory] = useState(false);
  const [used, setUsed] = useState(initialRow);
  const [error, setError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => {
    if (initialRow && rows.length === 0 && !bulkBusy && !directory) onEmpty?.();
  }, [initialRow, rows.length, bulkBusy, directory, onEmpty]);
  const remove = (id: string) => setRows((current) => current.filter((row) => row.key !== id));
  async function addMany(choices: TaskChoice[]) {
    const drafts = choices.map((choice) => ({ key: crypto.randomUUID(), choice }));
    setRows((current) => [...current, ...drafts]);
    setError('');
    setBulkBusy(true);
    try {
      for (const row of drafts) {
        const parameters = parameterDefaults(row.choice.name);
        if (!parametersValid(row.choice.name, parameters)) continue;
        await mutate(() => addScheduleTask(scheduleId, row.choice.id, { parameters }));
        remove(row.key);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <>
      {(used || existing.length > 0) && (
        <IconButton
          icon="presets"
          disabled={disabled || bulkBusy}
          onClick={() => setDirectory(true)}
        >
          {tr('TaskDirectory.title')}
        </IconButton>
      )}
      {children}
      {rows.map((row) => (
        <NewTaskRow
          key={row.key}
          initialChoice={row.choice}
          scheduleId={scheduleId}
          disabled={disabled || bulkBusy}
          mutate={mutate}
          onRemove={() => remove(row.key)}
          onAdded={() => remove(row.key)}
        />
      ))}
      <Button
        variant="ghost"
        className="schedule-task-toggle"
        disabled={disabled || bulkBusy || rows.length + existing.length >= 100}
        onClick={() => {
          setUsed(true);
          setRows((current) => [...current, { key: crypto.randomUUID() }]);
        }}
      >
        {tr('ScheduleTasks.addRow')}
      </Button>
      {error && <ErrorBox error={error} />}
      {directory && (
        <TaskDirectory
          existing={[...existing, ...rows.flatMap((row) => (row.choice ? [row.choice] : []))]}
          capacity={100 - existing.length - rows.length}
          onAdd={(choices) => void addMany(choices)}
          onClose={() => setDirectory(false)}
        />
      )}
    </>
  );
}
