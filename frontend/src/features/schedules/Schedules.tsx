import { toggleScheduleCompletion } from './scheduleCompletion';
import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { NewTaskRows, SavedTaskRow } from './ScheduleTaskRows';
import { deleteSchedule, deleteScheduleTask } from '../../api/schedules';
import { DisclosureSummary, PageHeader, Input, Surface } from '../shared/ui';
import { PresetModal } from '../shared/PresetModal';
import { Photos } from './Photos';
import { TaskExecution } from './TaskExecution';
import { Requirements } from '../works/Requirements';
import { textFields } from '../works/fields';
import { useEffect, useRef, useState } from 'react';
import { getSchedule, type ScheduleDetail } from '../../api/schedules';

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
    if (mutationLock.current) throw new LocalizedError('Schedules.operationUnavailable');
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
  async function changeCompletion() {
    if (!value) return;
    setError('');
    try {
      await mutate(() => toggleScheduleCompletion(value));
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
          <ScheduleEditor
            initial={value}
            embedded={modal}
            completionControl={
              <Input
                type="checkbox"
                aria-label={tr('Schedules.completeSchedule')}
                checked={value.status === 'completed'}
                disabled={busy || value.status === 'cancelled'}
                onChange={() => void changeCompletion()}
              />
            }
            mutationBusy={busy}
            taskContent={
              <section
                className="work-stack execution-task-list"
                aria-label={tr('UI.executionTasks')}
              >
                <NewTaskRows
                  scheduleId={id}
                  existing={value.tasks.map((task) => ({
                    id: task.id,
                    name: task.name_template_snapshot ?? task.name_snapshot,
                  }))}
                  disabled={busy || value.status === 'cancelled'}
                  mutate={mutate}
                >
                  {value.tasks.map((task) => (
                    <div key={task.id}>
                      <SavedTaskRow
                        key={task.name_snapshot}
                        task={task}
                        disabled={busy || value.status === 'cancelled'}
                        mutate={mutate}
                        onEdit={() => setTaskEditor(task.id)}
                      />
                    </div>
                  ))}
                </NewTaskRows>
              </section>
            }
            onDelete={async () => {
              await deleteSchedule(id);
              if (onClose) onClose();
              else window.location.hash = '/today';
            }}
            onCancel={onClose || (() => {})}
            onSaved={onClose || (() => setAttempt((n) => n + 1))}
          />

          <Surface as="section" className="detail-section memo-preview">
            <details className="optional-fields">
              <DisclosureSummary>{tr('UI.workDetails')}</DisclosureSummary>
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
            </details>
          </Surface>
          {value.tasks
            .filter((task) => taskEditor === task.id)
            .map((task) => (
              <PresetModal
                key={task.id}
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
            ))}
          <Photos target={{ type: 'schedule', id }} locked={value.status === 'cancelled'} />
        </>
      )}
    </section>
  );
}

export function ScheduleModal({
  id,
  initialDate,
  timeZone,
  onClose,
  onSaved,
}: {
  id?: string;
  initialDate?: string;
  timeZone?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <PresetModal
      label={id ? tr('ScheduleEditor.editSchedule') : tr('App.addSchedule')}
      variant="schedule"
      closeLabel={id ? tr('PresetModal.closeDetails') : tr('App.closeNewSchedule')}
      onClose={onClose}
    >
      {id ? (
        <ScheduleView id={id} modal onClose={onClose} />
      ) : timeZone ? (
        <ScheduleEditor
          embedded
          timeZone={timeZone}
          initialDate={initialDate}
          onCancel={onClose}
          onSaved={onSaved}
        />
      ) : (
        <p role="status">{tr('App.loadingAppSettings')}</p>
      )}
    </PresetModal>
  );
}
