import { useSettings } from '../settings/settingsContext';
import { toTime } from './timeRange';
import { DeleteButton } from '../shared/SwipeDelete';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ReminderSettings } from './ReminderSettings';
import { ScheduleColorPicker } from './ScheduleColorPicker';
import { MemoButton } from '../shared/MemoButton';
import { TaskParameterInputs } from '../shared/TaskParameterInputs';
import { parameterDefaults, parametersValid, renderTaskName } from '../shared/taskParameters';
import type { TaskCustomization } from '../../api/schedules';
import { ButtonLink, Input, Button, Textarea, PageHeader } from '../shared/ui';
import { TaskGroupPicker } from './TaskGroupPicker';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { ModalActions } from '../shared/PresetModal';
import { saveSchedule, type ScheduleDetail, type ScheduleFields } from '../../api/schedules';
import { getWorkTasks } from '../../api/workTasks';
import { ErrorBox } from '../shared/ErrorBox';
import { go, message } from '../shared/form';
import { useEditorActive } from '../useEditorActive';
import { Picker } from './Picker';
import { TimeDial } from './TimeDial';
import { dateInZone, nextDate } from './timeRange';
const mobileQuery = '(max-width: 700px)';
function subscribeMobile(update: () => void) {
  const query = window.matchMedia?.(mobileQuery);
  query?.addEventListener('change', update);
  return () => query?.removeEventListener('change', update);
}
const readMobile = () => window.matchMedia?.(mobileQuery).matches ?? false;
export function ScheduleEditor({
  embedded = false,
  hideMemo = false,
  initial,
  initialDate,
  onSaved,
  onCancel,
  onDelete,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  embedded?: boolean;
  hideMemo?: boolean;
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
  const mobile = useSyncExternalStore(subscribeMobile, readMobile, () => false);
  const taskCard = useRef<HTMLDivElement>(null);
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
          start_time: '09:00',
          end_time: '10:00',
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
  const [work, setWork] = useState<{ id: string; name: string }>();
  const [showWorks, setShowWorks] = useState(true);
  const [showTasks, setShowTasks] = useState(false);
  useEffect(() => {
    if (mobile && showTasks) taskCard.current?.scrollIntoView?.({ block: 'nearest' });
  }, [mobile, showTasks]);
  const [tasks, setTasks] = useState<{ id: string; name: string }[]>([]);
  const [customizations, setCustomizations] = useState<Record<string, TaskCustomization>>({});
  function customize(id: string, changes: TaskCustomization) {
    setCustomizations((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
  }
  const [loading, setLoading] = useState(false);
  const [defaultsError, setDefaultsError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function choose(w: { id: string; name: string }) {
    const token = ++generation.current;
    setWork(w);
    setShowTasks(false);
    setShowWorks(false);
    setTasks([]);
    setCustomizations({});
    setLoading(true);
    setDefaultsError('');
    try {
      const t = await getWorkTasks(w.id);
      if (active.current && token === generation.current) setTasks(t.filter((x) => !x.archived));
    } catch (e) {
      if (active.current && token === generation.current) setDefaultsError(message(e));
    } finally {
      if (active.current && token === generation.current) setLoading(false);
    }
  }
  function move(index: number, delta: number) {
    const next = [...tasks];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    setTasks(next);
  }
  function toggleMulti(checked: boolean) {
    setMultiDay(checked);
    setError('');
    setFields((f) => ({
      ...f,
      end_date: checked ? nextDate(f.scheduled_date) : f.scheduled_date,
      ...(!checked && f.end_time <= f.start_time ? { start_time: '09:00', end_time: '10:00' } : {}),
    }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const endDate = multiDay ? fields.end_date : fields.scheduled_date;
    if (
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
    if (!initial && (!work || loading || defaultsError)) return;
    if (
      !initial &&
      tasks.some((task) => !parametersValid(task.name, customizations[task.id]?.parameters ?? {}))
    ) {
      setError('ScheduleEditor.fillInTheTaskParametersTheCompletedNameCan');
      return;
    }
    setBusy(true);
    try {
      const createFields: Partial<ScheduleFields> = { ...fields };
      if (hideMemo) delete createFields.notes;
      const values = {
        ...createFields,
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
              task_preset_ids: tasks.map((t) => t.id),
              task_customizations: Object.fromEntries(
                tasks.map((t) => [t.id, customizations[t.id] ?? {}]),
              ),
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
        <fieldset disabled={busy} className="schedule-form">
          <div className="schedule-compose">
            <section className="schedule-time-panel schedule-card-stage">
              <div className={`schedule-flip-card${showTasks ? ' is-flipped' : ''}`}>
                {!mobile && !initial && (
                  <div
                    className="schedule-card-face schedule-card-back"
                    ref={taskCard}
                    inert={!showTasks}
                    aria-hidden={!showTasks}
                  >
                    <div className="schedule-panel-heading">
                      <h2>{tr('ScheduleEditor.taskGroups')}</h2>
                      <IconButton icon="close" type="button" onClick={() => setShowTasks(false)}>
                        {mobile
                          ? tr('ScheduleEditor.closeTaskSelection')
                          : tr('ScheduleEditor.backToDial')}
                      </IconButton>
                    </div>
                    <TaskGroupPicker
                      selected={tasks.map((t) => t.id)}
                      onPick={(t) =>
                        setTasks((rows) =>
                          rows.length >= 100 || rows.some((x) => x.id === t.id)
                            ? rows
                            : [...rows, t],
                        )
                      }
                    />
                  </div>
                )}
                <div
                  className="schedule-card-face schedule-card-front"
                  inert={showTasks && !mobile}
                  aria-hidden={showTasks && !mobile}
                >
                  <div className="schedule-panel-heading">
                    <h2>{multiDay ? tr('ScheduleEditor.dateAndTime') : tr('app.time')}</h2>
                  </div>
                  {multiDay && (
                    <label>
                      {tr('ScheduleEditor.startDate')}
                      <Input
                        required
                        type="date"
                        min="0001-01-01"
                        max="9999-12-31"
                        value={fields.scheduled_date}
                        onChange={(e) =>
                          setFields({
                            ...fields,
                            scheduled_date: e.target.value,
                            end_date: multiDay ? fields.end_date : e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <TimeDial
                    independentEndpoints={multiDay}
                    daySpan={
                      multiDay
                        ? Math.max(
                            0,
                            (Date.parse(fields.end_date) - Date.parse(fields.scheduled_date)) /
                              86400000,
                          ) || 0
                        : 0
                    }
                    start={fields.start_time}
                    end={fields.end_time}
                    disabled={busy}
                    onChange={(range) =>
                      setFields({ ...fields, start_time: range.start, end_time: range.end })
                    }
                  />
                  {multiDay && (
                    <div className="manual-time-range">
                      <label>
                        {tr('ScheduleEditor.endDate')}
                        <Input
                          required
                          type="date"
                          min={fields.scheduled_date}
                          max="9999-12-31"
                          value={fields.end_date}
                          onChange={(e) => setFields({ ...fields, end_date: e.target.value })}
                        />
                      </label>
                      <div className="schedule-times">
                        <label>
                          {tr('ScheduleEditor.startTime')}
                          <Input
                            required
                            type="time"
                            step={60}
                            value={fields.start_time}
                            onChange={(e) => setFields({ ...fields, start_time: e.target.value })}
                          />
                        </label>
                        <label>
                          {tr('ScheduleEditor.endTime')}
                          <Input
                            min="00:01"
                            required
                            type="time"
                            step={60}
                            value={fields.end_time}
                            onChange={(e) => setFields({ ...fields, end_time: e.target.value })}
                          />
                        </label>
                      </div>
                      <p className="hint">
                        {tr('ScheduleEditor.setTheStartAndEndDatesAndTimesTimes')}
                      </p>
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
                </div>
              </div>
            </section>
            <section className="schedule-content-panel">
              <div className="schedule-panel-heading">
                <h2>{tr('ScheduleEditor.work')}</h2>
              </div>
              {initial ? (
                <p className="selected-work">{initial.entity_snapshot.name}</p>
              ) : (
                <>
                  {work && (
                    <div className="selected-work memo-preview">
                      <strong>{work.name}</strong>
                      <MemoButton
                        label={work.name}
                        value={fields.notes}
                        onSave={async (notes) => setFields((f) => ({ ...f, notes }))}
                        scope={tr('ScheduleEditor.memoForThisWorkSavedTogetherWithTheSchedule')}
                      />
                      <Button
                        iconOnly
                        variant="ghost"
                        type="button"
                        aria-label={
                          showWorks ? tr('ScheduleEditor.close') : tr('ScheduleEditor.change')
                        }
                        title={showWorks ? tr('ScheduleEditor.close') : tr('ScheduleEditor.change')}
                        onClick={() => setShowWorks(!showWorks)}
                      >
                        <ActionIcon name={showWorks ? 'close' : 'edit'} />
                      </Button>
                    </div>
                  )}
                  {showWorks && <Picker kind="work" onPick={(w) => void choose(w)} />}
                </>
              )}
              {loading && <p role="status">{tr('ScheduleEditor.loadingDefaultTasks')}</p>}
              {defaultsError && (
                <ErrorBox
                  error={defaultsError}
                  retry={() => {
                    if (work) void choose(work);
                  }}
                />
              )}
              {!initial && work && !loading && !defaultsError && (
                <div className="schedule-tasks">
                  <h3>
                    {tr('ScheduleEditor.includedTasks')}
                    <span>{tasks.length}</span>
                  </h3>
                  <ol className="work-task-list">
                    {tasks.map((t, i) => (
                      <li key={t.id} className="compose-task memo-preview">
                        <Button
                          variant="danger"
                          type="button"
                          className="schedule-todo-remove"
                          aria-label={tr('ScheduleEditor.removeValue', { v1: t.name })}
                          title={tr('ScheduleEditor.clickToRemove')}
                          onClick={() => setTasks((rows) => rows.filter((x) => x.id !== t.id))}
                        >
                          <span>
                            {renderTaskName(t.name, customizations[t.id]?.parameters ?? {})}
                          </span>
                          <ActionIcon name="close" />
                        </Button>
                        <div className="work-task-actions">
                          <MemoButton
                            label={t.name}
                            value={customizations[t.id]?.execution_notes ?? ''}
                            scope={tr('ScheduleEditor.memoForThisTaskSavedTogetherWithTheSchedule')}
                            onSave={async (execution_notes) => customize(t.id, { execution_notes })}
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
                        <TaskParameterInputs
                          template={t.name}
                          values={customizations[t.id]?.parameters ?? parameterDefaults(t.name)}
                          onChange={(parameters) => customize(t.id, { parameters })}
                        />
                      </li>
                    ))}
                  </ol>
                  {!tasks.length && (
                    <p className="hint">{tr('ScheduleEditor.youCanSaveWithoutAnyTasks')}</p>
                  )}
                  <Button
                    type="button"
                    className="schedule-task-toggle"
                    aria-expanded={showTasks}
                    onClick={() => setShowTasks(!showTasks)}
                  >
                    <ActionIcon name={showTasks ? 'close' : 'plus'} />
                    {tr('ScheduleEditor.task')}
                  </Button>
                  {mobile && showTasks && (
                    <div
                      className="schedule-time-panel mobile-task-selection"
                      ref={taskCard}
                      inert={!showTasks}
                      aria-hidden={!showTasks}
                    >
                      <div className="schedule-panel-heading">
                        <h2>{tr('ScheduleEditor.taskGroups')}</h2>
                        <IconButton icon="close" type="button" onClick={() => setShowTasks(false)}>
                          {mobile
                            ? tr('ScheduleEditor.closeTaskSelection')
                            : tr('ScheduleEditor.backToDial')}
                        </IconButton>
                      </div>
                      <TaskGroupPicker
                        selected={tasks.map((t) => t.id)}
                        onPick={(t) =>
                          setTasks((rows) =>
                            rows.length >= 100 || rows.some((x) => x.id === t.id)
                              ? rows
                              : [...rows, t],
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              )}
              <ReminderSettings
                value={fields}
                onChange={(reminder) => setFields({ ...fields, ...reminder })}
              />
              <ScheduleColorPicker
                value={fields.color ?? 'none'}
                onChange={(color) => setFields({ ...fields, color })}
              />
              {!hideMemo && (
                <div className="schedule-notes">
                  <label>
                    {tr('ScheduleEditor.scheduleMemo')}
                    <Textarea
                      rows={3}
                      maxLength={5000}
                      value={fields.notes}
                      placeholder={tr('ScheduleEditor.memoForThisScheduleOnly')}
                      onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                    />
                  </label>
                  <p className="hint">
                    {tr('ScheduleEditor.thisMemoIsSavedOnlyToThisScheduleAnd')}
                  </p>
                </div>
              )}
              {initial && (
                <p className="hint">
                  {tr('ScheduleEditor.theOriginalWorkAndTaskSelectionIsPreserved')}
                </p>
              )}
            </section>
          </div>
          {error && <ErrorBox error={error} />}
          <ModalActions>
            <div className="schedule-save">
              {initial && onDelete && (
                <DeleteButton
                  label={initial.entity_snapshot.name}
                  onDelete={onDelete}
                  disabled={busy}
                />
              )}
              <span>
                {multiDay ? `${fields.scheduled_date} → ${fields.end_date}` : null}
                <strong>
                  {fields.start_time} — {fields.end_time}
                </strong>
              </span>
              {onCancel && !embedded && (
                <Button
                  iconOnly
                  variant="ghost"
                  type="button"
                  onClick={onCancel}
                  aria-label={tr('Photos.cancel')}
                  title={tr('Photos.cancel')}
                >
                  <ActionIcon name="close" />
                </Button>
              )}
              <IconButton
                variant="primary"
                icon="save"

                disabled={busy || (!initial && (!work || loading || Boolean(defaultsError)))}
                form={formId}
                type="submit"
              >
                {busy ? tr('Photos.saving') : tr('ScheduleEditor.saveSchedule')}{' '}
                <span aria-hidden="true">↗</span>
              </IconButton>
            </div>
          </ModalActions>
        </fieldset>
      </form>
    </section>
  );
}
