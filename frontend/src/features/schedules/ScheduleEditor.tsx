import { useSettings } from '../settings/settingsContext';
import { toTime } from './timeRange';
import { DeleteButton } from '../shared/SwipeDelete';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ReminderSettings } from './ReminderSettings';
import { ScheduleColorPicker } from './ScheduleColorPicker';
import { MemoButton } from '../shared/MemoButton';
import { TaskParameterInputs } from '../shared/TaskParameterInputs';
import { parameterDefaults } from '../shared/taskParameters';
import { useScheduleTaskDraft, taskDraftError, taskDraftFields } from './useScheduleTaskDraft';
import {
  DisclosureSummary,
  ButtonLink,
  Input,
  Button,
  AutoTextarea,
  PageHeader,
} from '../shared/ui';
import { TaskNameInput } from './TaskNameInput';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { useId, useState } from 'react';
import { useMobileLayout } from '../shared/useMobileLayout';
import { ModalActions } from '../shared/PresetModal';
import { saveSchedule, type ScheduleDetail, type ScheduleFields } from '../../api/schedules';
import { ErrorBox } from '../shared/ErrorBox';
import { go, message } from '../shared/form';
import { useEditorActive } from '../useEditorActive';
import { Picker } from './Picker';
import { TimeDial } from './TimeDial';
import { TaskDirectory } from './TaskDirectory';
import { DatePicker, TimePicker } from '../shared/DateTimePicker';
import { dateInZone, nextDate } from './timeRange';
export function ScheduleEditor({
  embedded = false,
  initial,
  initialDate,
  onSaved,
  onCancel,
  onDelete,
  completionControl,
  taskContent,
  mutationBusy = false,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  completionControl?: React.ReactNode;
  taskContent?: React.ReactNode;
  mutationBusy?: boolean;
  embedded?: boolean;
  initial?: ScheduleDetail;
  initialDate?: string;
  onSaved?: () => void;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
  timeZone?: string;
}) {
  useTranslation();
  const step = useSettings().values.clock_step;
  const active = useEditorActive();
  const formId = useId();
  const mobile = useMobileLayout();
  const [fields, setFields] = useState<ScheduleFields>(() =>
    initial
      ? {
          title: initial.title,
          scheduled_date: initial.scheduled_date,
          end_date: initial.end_date,
          start_time: initial.start_time,
          end_time: initial.end_time === '00:00' ? toTime(step) : initial.end_time,
          time_zone: initial.time_zone,
          notes: initial.notes,
          color: initial.color ?? 'none',
          reminder_enabled: initial.reminder_enabled ?? false,
          reminder_value: initial.reminder_value ?? 15,
          reminder_unit: initial.reminder_unit ?? 'minutes',
        }
      : {
          title: '',
          scheduled_date: initialDate || dateInZone(timeZone),
          end_date: initialDate || dateInZone(timeZone),
          start_time: '',
          end_time: '',
          time_zone: timeZone,
          notes: '',
          color: 'none',
          reminder_enabled: false,
          reminder_value: 15,
          reminder_unit: 'minutes',
        },
  );
  const [multiDay, setMultiDay] = useState(
    Boolean(initial && initial.end_date > initial.scheduled_date),
  );
  const draft = useScheduleTaskDraft();
  const { work, tasks, customize, move } = draft;
  const [showWorks, setShowWorks] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState(false);
  const [addedTask, setAddedTask] = useState(false);
  function choose(w: { id: string; name: string }) {
    setShowWorks(false);
    return draft.choose(w);
  }
  function toggleMulti(checked: boolean) {
    setMultiDay(checked);
    setError('');
    setFields((f) => ({
      ...f,
      end_date: checked ? nextDate(f.scheduled_date) : f.scheduled_date,
      ...(!checked && f.end_time <= f.start_time ? { start_time: '', end_time: '' } : {}),
    }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || mutationBusy) return;
    setError('');
    const endDate = multiDay ? fields.end_date : fields.scheduled_date;
    if (
      !fields.start_time ||
      !fields.end_time ||
      fields.end_time === '00:00' ||
      endDate < fields.scheduled_date ||
      (endDate === fields.scheduled_date && fields.end_time <= fields.start_time)
    ) {
      setError('ScheduleEditor.theEndDateAndTimeMustBeAfterThe');
      return;
    }
    if (multiDay && endDate === fields.scheduled_date) {
      setError('ScheduleEditor.forAMultiDayScheduleChooseAnEndDate');
      return;
    }
    if (!initial && !work?.name.trim()) return;
    const draftError = initial ? '' : taskDraftError(tasks);
    if (draftError) {
      setError(draftError);
      return;
    }
    setBusy(true);
    try {
      const values = {
        ...fields,
        title: initial?.entity_snapshot.name ?? work!.name,
        end_date: endDate,
        time_zone: initial?.time_zone ?? timeZone,
      };
      const saved = await saveSchedule(
        initial
          ? values
          : {
              ...values,
              entity_id: work!.id,
              ...taskDraftFields(tasks),
            },
        initial?.id,
      );
      if (active.current) {
        if (onSaved) onSaved();
        else go('/schedules/' + saved.id);
      }
    } catch (e) {
      if (active.current) setError(message(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="schedule-editor">
      {!onCancel && (
        <ButtonLink
          iconOnly
          title={tr('ScheduleEditor.backToSchedule')}
          aria-label={tr('ScheduleEditor.backToSchedule')}
          className="back-link"
          href={initial ? '#/schedules/' + initial.id : '#/calendar'}
        >
          <ActionIcon name="left" />
        </ButtonLink>
      )}
      {!embedded && (
        <PageHeader className="schedule-heading">
          <h1>{initial ? tr('ScheduleEditor.editSchedule') : tr('App.addSchedule')}</h1>
        </PageHeader>
      )}
      <form id={formId} onSubmit={(e) => void submit(e)}>
        <fieldset disabled={busy || mutationBusy} className="schedule-form">
          <div className="schedule-compose">
            <div className="schedule-work-selection">
              <ScheduleColorPicker
                value={fields.color ?? 'none'}
                onChange={(color) => setFields({ ...fields, color })}
              />
              <div className="schedule-panel-heading">
                <h2>{tr('ScheduleEditor.work')}</h2>
              </div>
              {initial ? (
                <div className="selected-work schedule-work-title">
                  {completionControl}
                  <span>{initial.entity_snapshot.name}</span>
                </div>
              ) : (
                <>
                  {work && !showWorks && (
                    <div className="selected-work memo-preview">
                      <strong>{work.name}</strong>
                      <Button
                        variant="ghost"
                        type="button"
                        aria-label={
                          showWorks ? tr('ScheduleEditor.close') : tr('ScheduleEditor.change')
                        }
                        title={showWorks ? tr('ScheduleEditor.close') : tr('ScheduleEditor.change')}
                        onClick={() => setShowWorks(!showWorks)}
                      >
                        {showWorks ? tr('ScheduleEditor.close') : tr('ScheduleEditor.change')}
                      </Button>
                    </div>
                  )}
                  {showWorks && (
                    <Picker
                      allowCreate
                      kind="work"
                      initialName={work?.name}
                      onNameChange={(w) => void draft.choose(w)}
                      onPick={(w) => void choose(w)}
                    />
                  )}
                </>
              )}
            </div>

            <section className="schedule-time-panel schedule-card-stage">
              <div>
                <div>
                  <details className="schedule-time-disclosure" open={!mobile}>
                    <DisclosureSummary>
                      <span>{tr('app.time')}</span>
                      <strong>
                        {fields.start_time} — {fields.end_time}
                      </strong>
                      {multiDay && (
                        <span>
                          {fields.scheduled_date} → {fields.end_date}
                        </span>
                      )}
                    </DisclosureSummary>
                    <div className="schedule-panel-heading">
                      <h2>{multiDay ? tr('ScheduleEditor.dateAndTime') : tr('app.time')}</h2>
                    </div>
                    {multiDay && (
                      <DatePicker
                        label={tr('ScheduleEditor.startDate')}
                        value={fields.scheduled_date}
                        onChange={(date) =>
                          setFields({
                            ...fields,
                            scheduled_date: date,
                            end_date: multiDay ? fields.end_date : date,
                          })
                        }
                      />
                    )}

                    {!multiDay && (
                      <TimeDial
                        start={fields.start_time}
                        end={fields.end_time}
                        disabled={busy}
                        onChange={(range) =>
                          setFields({ ...fields, start_time: range.start, end_time: range.end })
                        }
                      />
                    )}
                    {multiDay && (
                      <div className="manual-time-range">
                        <DatePicker
                          label={tr('ScheduleEditor.endDate')}
                          value={fields.end_date}
                          onChange={(date) => setFields({ ...fields, end_date: date })}
                        />
                        <div className="schedule-times">
                          <TimePicker
                            label={tr('ScheduleEditor.startTime')}
                            value={fields.start_time}
                            onChange={(time) => setFields({ ...fields, start_time: time })}
                          />
                          <TimePicker
                            label={tr('ScheduleEditor.endTime')}
                            min="00:01"
                            value={fields.end_time}
                            onChange={(time) => setFields({ ...fields, end_time: time })}
                          />
                        </div>
                      </div>
                    )}
                    <label className="multi-day-toggle">
                      <Input
                        type="checkbox"
                        checked={multiDay}
                        onChange={(e) => toggleMulti(e.target.checked)}
                      />
                      <span>{tr('ScheduleEditor.scheduleSpanningMultipleDays')}</span>
                    </label>
                  </details>
                </div>
              </div>
            </section>
            <section className="schedule-content-panel">
              {taskContent}
              {!initial && (
                <div className="schedule-tasks">
                  {(addedTask || tasks.length > 0) && (
                    <IconButton icon="presets" onClick={() => setDirectory(true)}>
                      {tr('TaskDirectory.title')}
                    </IconButton>
                  )}
                  <ol className="work-task-list">
                    {tasks.map((t, i) => (
                      <li key={t.rowKey} className="compose-task memo-preview">
                        <div className="schedule-task-row">
                          <Input
                            type="checkbox"
                            className="task-check"
                            checked={false}
                            disabled
                            aria-label={tr('SavedScheduleCard.completeValue', { v1: t.name })}
                          />
                          <TaskNameInput
                            value={t.name}
                            autoFocus={t.source === 'manual'}
                            onChange={(choice) => draft.rename(t.rowKey, choice)}
                          />
                          <Button
                            variant="ghost"
                            aria-label={tr('ScheduleEditor.removeValue', { v1: t.name })}
                            onClick={() => draft.remove(t.rowKey)}
                          >
                            <ActionIcon name="close" />
                          </Button>
                        </div>
                        {t.name.trim() && (
                          <>
                            <div className="work-task-actions">
                              <MemoButton
                                label={t.name}
                                value={t.execution_notes ?? ''}
                                onSave={async (execution_notes) =>
                                  customize(t.rowKey, { execution_notes })
                                }
                              />
                              <Button
                                iconOnly
                                variant="ghost"
                                type="button"
                                aria-label={tr('ScheduleEditor.moveValueUp', { v1: t.name })}
                                disabled={!i}
                                onClick={() => move(i, -1)}
                              >
                                <ActionIcon name="up" />
                              </Button>
                              <Button
                                iconOnly
                                variant="ghost"
                                type="button"
                                aria-label={tr('ScheduleEditor.moveValueDown', { v1: t.name })}
                                disabled={i === tasks.length - 1}
                                onClick={() => move(i, 1)}
                              >
                                <ActionIcon name="down" />
                              </Button>
                            </div>
                          </>
                        )}
                        <TaskParameterInputs
                          template={t.name}
                          values={t.parameters ?? parameterDefaults(t.name)}
                          onChange={(parameters) => customize(t.rowKey, { parameters })}
                        />
                      </li>
                    ))}
                  </ol>
                  <Button
                    variant="ghost"
                    className="schedule-task-toggle"
                    disabled={tasks.length >= 100}
                    onClick={() => {
                      setAddedTask(true);
                      draft.add();
                    }}
                  >
                    {tr('ScheduleTasks.addRow')}
                  </Button>
                </div>
              )}
              <ReminderSettings
                disabled={busy}
                value={fields}
                onChange={(reminder) => setFields({ ...fields, ...reminder })}
              />
              <div className="schedule-notes">
                <label>
                  {tr('ScheduleEditor.scheduleMemo')}
                  <AutoTextarea
                    rows={3}
                    maxLength={5000}
                    value={fields.notes}
                    onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                  />
                </label>
              </div>
            </section>
          </div>
          {error && <ErrorBox error={error} />}
          <ModalActions>
            <div className="schedule-save">
              <span>
                {multiDay
                  ? `${fields.scheduled_date} → ${fields.end_date}`
                  : !initial && (
                      <time dateTime={fields.scheduled_date}>{fields.scheduled_date}</time>
                    )}
                <strong>
                  {fields.start_time} — {fields.end_time}
                </strong>
              </span>
              {initial && onDelete && (
                <DeleteButton
                  variant="ghost"
                  label={initial.entity_snapshot.name}
                  onDelete={onDelete}
                  disabled={busy}
                />
              )}

              <Button
                variant="ghost"
                aria-busy={busy || undefined}

                disabled={busy || mutationBusy || (!initial && !work?.name.trim())}
                form={formId}
                type="submit"
              >
                <ActionIcon name="save" />
                {tr('ScheduleEditor.saveSchedule')}
              </Button>
            </div>
          </ModalActions>
        </fieldset>
      </form>
      {directory && (
        <TaskDirectory
          existing={tasks}
          capacity={100 - tasks.length}
          onAdd={draft.addMany}
          onClose={() => setDirectory(false)}
        />
      )}
    </section>
  );
}
