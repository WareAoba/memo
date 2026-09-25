import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { reminderUnitLabel } from '../../api/reminderFields';
import { MemoEditor } from '../shared/MemoEditor';
import {
  saveSchedule,
  deleteSchedule,
  deleteScheduleTask,
  reopenSchedule,
} from '../../api/schedules';
import { PageHeader, Button, Surface } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetModal } from '../shared/PresetModal';
import { Photos } from './Photos';
import { TaskExecution } from './TaskExecution';
import { Requirements } from '../works/Requirements';
import { textFields } from '../works/fields';
import { progressOf, statusLabel } from '../workspace/progress';
import { useEffect, useRef, useState } from 'react';
import { updateScheduleStatus, getSchedule, type ScheduleDetail } from '../../api/schedules';

import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { useEditorActive } from '../useEditorActive';

import { ScheduleEditor } from './ScheduleEditor';
export { ScheduleEditor } from './ScheduleEditor';
export function ScheduleView({
  id,
  modal = false,
  onClose,
}: {
  id: string;
  edit?: boolean;
  modal?: boolean;
  onClose?: () => void;
}) {
  useTranslation();
  const active = useEditorActive();
  const [taskEditor, setTaskEditor] = useState<string>();
  const [value, setValue] = useState<ScheduleDetail>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    getSchedule(id, c.signal)
      .then((v) => {
        if (!c.signal.aborted) setValue(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [id, attempt]);
  const mutationLock = useRef(false);
  async function mutate(operation: () => Promise<ScheduleDetail>) {
    if (mutationLock.current)
      throw new LocalizedError('Schedules.savingIsInProgressTryAgainShortly');
    mutationLock.current = true;
    setBusy(true);
    try {
      const result = await operation();
      if (active.current) setValue(result);
    } finally {
      mutationLock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function changeStatus(status: string) {
    setError('');
    try {
      await mutate(() => updateScheduleStatus(id, status));
    } catch (e) {
      if (active.current) setError(message(e));
    }
  }

  return (
    <section>
      {!modal && (
        <>
          <a href="#/today">{tr('Schedules.today')}</a> ·{' '}
          <a href="#/calendar">{tr('Schedules.calendar')}</a>
        </>
      )}
      {error && (
        <ErrorBox
          error={error}
          retry={
            !value
              ? () => {
                  setError('');
                  setAttempt((n) => n + 1);
                }
              : undefined
          }
        />
      )}
      {!value && !error && <p role="status">{tr('Schedules.loadingSchedules')}</p>}
      {value && (
        <>
          {!modal && (
            <PageHeader className="workspace-heading">
              <h1>{value.title || tr('Schedules.untitledSchedule')}</h1>
            </PageHeader>
          )}
          <section className="work-stack execution-task-list" aria-label={tr('UI.executionTasks')}>
            <h2>{tr('UI.executionTasks')}</h2>
            {value.tasks.map((task) => (
              <div key={task.id}>
                <Button variant="option" onClick={() => setTaskEditor(task.id)}>
                  {task.name_snapshot}
                </Button>
                {taskEditor === task.id && (
                  <PresetModal
                    label={tr('MemoEditor.editValue', { v1: task.name_snapshot })}
                    onClose={() => {
                      if (!busy) setTaskEditor(undefined);
                    }}
                  >
                    <TaskExecution
                      allowRename
                      onDelete={async () => {
                        await mutate(() => deleteScheduleTask(task.id));
                        setTaskEditor(undefined);
                      }}
                      task={task}
                      locked={value.status === 'cancelled'}
                      busy={busy}
                      mutate={mutate}
                    />
                  </PresetModal>
                )}
              </div>
            ))}
          </section>
          <ScheduleEditor
            initial={value}
            embedded={modal}
            hideMemo
            onDelete={async () => {
              await deleteSchedule(id);
              if (onClose) onClose();
              else window.location.hash = '/today';
            }}
            onCancel={onClose || (() => {})}
            onSaved={onClose || (() => setAttempt((n) => n + 1))}
          />
          <p>
            {value.time_zone} · {statusLabel(value.status)}
          </p>
          <p>
            {tr('Schedules.tasksValueValueCompletedValueSkipped', {
              v1: progressOf([value]).completed,
              v2: progressOf([value]).total,
              v3: progressOf([value]).skipped,
            })}
          </p>
          {value.reminder_enabled && (
            <p>
              {tr('Schedules.reminderValueValueBefore', {
                v1: value.reminder_value,
                v2: reminderUnitLabel(value.reminder_unit ?? 'minutes', value.reminder_value),
              })}
            </p>
          )}
          <Surface as="section" className="detail-section memo-preview">
            <div className="section-heading">
              <h2>{value.entity_snapshot.name}</h2>
            </div>
            <MemoEditor
              draftKey={'schedule:' + id}
              label={tr('Schedules.workMemo')}
              value={value.notes}
              disabled={busy}
              onSave={async (notes) => {
                await mutate(() => saveSchedule({ notes }, id));
              }}
            />
            <details className="optional-fields">
              <summary>{tr('UI.workDetails')}</summary>
              <Requirements value={value.entity_snapshot} />
              <dl>
                {(value.entity_snapshot.custom_fields ?? []).map((field, index) => (
                  <div key={index}>
                    <dt>{field.name || tr('Schedules.content')}</dt>
                    <dd className="preserve-lines">{field.value}</dd>
                  </div>
                ))}
                {textFields()
                  .filter(
                    ([key]) =>
                      key !== 'name' && key !== 'general_notes' && value.entity_snapshot[key],
                  )
                  .map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd className="preserve-lines">{value.entity_snapshot[key]}</dd>
                    </div>
                  ))}
              </dl>
              <p className="preserve-lines">{value.entity_snapshot.general_notes}</p>
              <p>{tr('Schedules.workAndTasksAsSavedWhenTheScheduleWas')}</p>
            </details>
          </Surface>
          <div className="work-task-actions">
            <Button
              variant="ghost"
              disabled={busy || value.status === 'cancelled'}
              onClick={() => {
                if (value.status === 'completed')
                  void mutate(() => reopenSchedule(id)).catch((e) => setError(message(e)));
                else void changeStatus('completed');
              }}
            >
              <ActionIcon name="check" />
              {value.status === 'completed'
                ? tr('Delete.reopen', { name: value.entity_snapshot.name })
                : tr('Schedules.completeSchedule')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void changeStatus(value.status === 'cancelled' ? 'planned' : 'cancelled')
              }
            >
              <ActionIcon name={value.status === 'cancelled' ? 'play' : 'close'} />
              {value.status === 'cancelled'
                ? tr('Schedules.resumeSchedule')
                : tr('Schedules.cancelSchedule')}
            </Button>
          </div>
          <Photos target={{ type: 'schedule', id }} locked={value.status === 'cancelled'} />
        </>
      )}
    </section>
  );
}
