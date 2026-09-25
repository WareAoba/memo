import { DeleteButton } from '../shared/SwipeDelete';
import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr, displayMessage } from '../../i18n';
import { Surface, Input } from '../shared/ui';
import { MemoEditor } from '../shared/MemoEditor';
import { TaskParameterInputs } from '../shared/TaskParameterInputs';
import { parameterDefaults, parametersValid, taskParameters } from '../shared/taskParameters';
import { IconButton } from '../shared/IconButton';
import { Photos } from './Photos';
import { useState } from 'react';
import {
  updateItem,
  updateTask,
  type ScheduleDetail,
  type ScheduleTask,
  type ExecutionItem,
} from '../../api/schedules';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { statusLabel } from '../workspace/progress';

function inputValue(item: ExecutionItem): string | boolean {
  if (item.definition.item_type === 'checkbox') return item.value_boolean === true;
  return String(item.value_text ?? item.value_number ?? '');
}
export function TaskExecution({
  task,
  locked,
  busy,
  mutate,
  onDelete,
  allowRename = false,
}: {
  task: ScheduleTask;
  allowRename?: boolean;
  onDelete?: () => Promise<void>;
  locked: boolean;
  busy: boolean;
  mutate: (operation: () => Promise<ScheduleDetail>) => Promise<void>;
}) {
  useTranslation();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(task.items.map((i) => [i.id, inputValue(i)])),
  );
  const template = task.name_template_snapshot ?? task.name_snapshot;
  const [name, setName] = useState(template);
  const [parameters, setParameters] = useState(
    task.parameter_values ?? parameterDefaults(template),
  );
  const [memoPending, setMemoPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const dirty =
    (allowRename &&
      (name !== template ||
        taskParameters(name).some(
          ({ key, defaultValue }) =>
            (parameters[key] ?? defaultValue) !== (task.parameter_values?.[key] ?? defaultValue),
        ))) ||
    memoPending ||
    task.items.some((i) => draft[i.id] !== inputValue(i));
  async function run(operation: () => Promise<ScheduleDetail>) {
    setError('');
    setSaved('');
    try {
      await mutate(operation);
      setSaved('TaskExecution.saved');
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  }
  function saveItem(item: ExecutionItem) {
    const raw = draft[item.id];
    let value: string | number | boolean | null = raw ?? null;
    if (item.definition.item_type === 'number') {
      value = String(raw).trim() === '' ? null : Number(raw);
      if (value !== null && !Number.isFinite(value)) {
        setError('TaskExecution.enterAValidNumber');
        return;
      }
    }
    void run(() => updateItem(item.id, value)).then((ok) => {
      if (ok)
        setDraft((d) => ({
          ...d,
          [item.id]: typeof value === 'boolean' ? value : String(value ?? ''),
        }));
    });
  }
  return (
    <Surface
      as="section"
      className="detail-section memo-preview"
      aria-label={tr('TaskExecution.runValue', { v1: task.name_snapshot })}
    >
      <div className="section-heading">
        {onDelete && (
          <DeleteButton label={task.name_snapshot} onDelete={onDelete} disabled={busy} />
        )}
        <h2>{task.name_snapshot}</h2>
      </div>
      <p>{statusLabel(task.status)}</p>
      {task.default_notes_snapshot && (
        <p className="preserve-lines">{task.default_notes_snapshot}</p>
      )}
      {locked && <p>{tr('TaskExecution.resumeTheScheduleToEditExecutionRecords')}</p>}
      <fieldset disabled={busy || locked} className="execution-fields">
        <legend>{tr('TaskExecution.taskExecution')}</legend>
        {allowRename && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!parametersValid(name, parameters))
                  throw new LocalizedError(
                    'ScheduleEditor.fillInTheTaskParametersTheCompletedNameCan',
                  );
                const result = await updateTask(task.id, {
                  name: name.trim(),
                  ...(taskParameters(name).length
                    ? {
                        parameters: Object.fromEntries(
                          taskParameters(name).map(({ key, defaultValue }) => [
                            key,
                            parameters[key] ?? defaultValue,
                          ]),
                        ),
                      }
                    : {}),
                });
                const updated = result.tasks.find((value) => value.id === task.id);
                if (updated) {
                  setName(updated.name_template_snapshot ?? updated.name_snapshot);
                  setParameters(updated.parameter_values ?? {});
                }
                return result;
              });
            }}
          >
            <label htmlFor={'task-name-' + task.id}>{tr('TaskExecution.taskName')}</label>
            <Input
              id={'task-name-' + task.id}
              value={name}
              required
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
            <TaskParameterInputs template={name} values={parameters} onChange={setParameters} />
            <IconButton
              icon="save"
              type="submit"
              disabled={
                !name.trim() ||
                (name === template &&
                  !taskParameters(name).some(
                    ({ key, defaultValue }) =>
                      (parameters[key] ?? defaultValue) !==
                      (task.parameter_values?.[key] ?? defaultValue),
                  ))
              }
            >
              {tr('TaskExecution.saveName')}
            </IconButton>
          </form>
        )}
        {task.items.map((item) => (
          <form
            key={item.id}
            onSubmit={(e) => {
              e.preventDefault();
              saveItem(item);
            }}
            className="execution-item"
          >
            <label htmlFor={'item-' + item.id}>
              {item.definition.label}
              {item.definition.required ? tr('TaskExecution.required') : ''}
              {item.definition.unit ? ` (${item.definition.unit})` : ''}
            </label>
            {item.definition.item_type === 'checkbox' ? (
              <Input
                id={'item-' + item.id}
                type="checkbox"
                checked={Boolean(draft[item.id])}
                onChange={(e) => {
                  setSaved('');
                  setDraft((d) => ({ ...d, [item.id]: e.target.checked }));
                }}
              />
            ) : (
              <Input
                id={'item-' + item.id}
                type={item.definition.item_type === 'number' ? 'number' : 'text'}
                step={item.definition.item_type === 'number' ? 'any' : undefined}
                maxLength={5000}
                value={String(draft[item.id] ?? '')}
                onChange={(e) => {
                  setSaved('');
                  setDraft((d) => ({ ...d, [item.id]: e.target.value }));
                }}
              />
            )}
            <IconButton icon="save" type="submit" disabled={draft[item.id] === inputValue(item)}>
              {tr('TaskExecution.saveValue', { v1: item.definition.label })}
            </IconButton>
          </form>
        ))}
        {dirty && <p role="status">{tr('TaskExecution.youHaveUnsavedInputSaveEachItemAndMemo')}</p>}
        <div className="work-task-actions">
          <IconButton
            icon="play"
            disabled={dirty || task.status === 'in_progress'}
            onClick={() => void run(() => updateTask(task.id, { status: 'in_progress' }))}
          >
            {tr('TaskExecution.start')}
          </IconButton>
          <IconButton
            icon="check"
            disabled={dirty}
            onClick={() =>
              void run(() =>
                updateTask(task.id, {
                  status: task.status === 'completed' ? 'pending' : 'completed',
                }),
              )
            }
          >
            {task.status === 'completed'
              ? tr('TaskExecution.undoCompletion')
              : tr('TaskExecution.completeTask')}
          </IconButton>
          <IconButton
            icon="skip"
            disabled={dirty}
            onClick={() =>
              void run(() =>
                updateTask(task.id, { status: task.status === 'skipped' ? 'pending' : 'skipped' }),
              )
            }
          >
            {task.status === 'skipped' ? tr('TaskExecution.undoSkip') : tr('TaskExecution.skip')}
          </IconButton>
        </div>
      </fieldset>
      <MemoEditor
        draftKey={'execution:' + task.id}
        value={task.execution_notes}
        label={tr('TaskExecution.executionMemo')}
        disabled={busy || locked}
        onPendingChange={setMemoPending}
        onSave={async (execution_notes) => {
          await mutate(() => updateTask(task.id, { execution_notes }));
        }}
      />
      {busy && <p role="status">{tr('Photos.saving')}</p>}
      {error && <ErrorBox error={error} />}
      {saved && <p role="status">{displayMessage(saved)}</p>}
      <Photos target={{ type: 'task', id: task.id }} locked={locked} />
    </Surface>
  );
}
