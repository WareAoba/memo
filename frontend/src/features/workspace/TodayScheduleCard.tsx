import { ScheduleTimeText } from '../schedules/ScheduleTimeText';
import { SwipeDelete, DeleteButton } from '../shared/SwipeDelete';
import { ScheduleCardActions } from '../shared/ScheduleCardActions';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface, Button, Input, ButtonLink } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { useState } from 'react';
import {
  deleteScheduleTask,
  updateTask,
  saveSchedule,
  type ScheduleDetail,
} from '../../api/schedules';
import { MemoButton } from '../shared/MemoButton';
import { Requirements } from '../works/Requirements';
import { TaskExecution } from '../schedules/TaskExecution';
import { NewTaskRows } from '../schedules/ScheduleTaskRows';
import { toggleScheduleCompletion } from '../schedules/scheduleCompletion';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { PresetModal } from '../shared/PresetModal';

export function TodayScheduleCard({
  value,
  selected,
  onSelect,
  busy,
  editing,
  onEditing,
  adding,
  onAdding,
  otherAdding,
  mutate,
  onDelete,
}: {
  value: ScheduleDetail;
  selected: boolean;
  onSelect: () => void;
  busy: boolean;
  editing?: string;
  onEditing: (id?: string) => void;
  adding: boolean;
  onAdding: (open: boolean) => void;
  otherAdding: boolean;
  onDelete: () => Promise<void>;
  mutate: (operation: () => Promise<ScheduleDetail>) => Promise<void>;
}) {
  useTranslation();
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const locked = value.status === 'cancelled';
  const completed = value.status === 'completed';
  const selectionLocked = busy || !!editing || adding || otherAdding;
  async function run(operation: () => Promise<ScheduleDetail>) {
    setError('');
    try {
      await mutate(operation);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  }
  return (
    <SwipeDelete label={value.entity_snapshot.name} onDelete={onDelete} disabled={selectionLocked}>
      <Surface
        as="article"
        className="today-schedule-card memo-preview schedule-card"
        data-selected={selected}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        data-context-content
        data-schedule-color={value.color ?? 'none'}
        aria-label={value.entity_snapshot.name}
        onClick={(event) => {
          if (
            !selectionLocked &&
            !(event.target as Element).closest(
              'button, a, input, textarea, select, label, [role="dialog"]',
            )
          )
            onSelect();
        }}
      >
        <header className="section-heading">
          <div className="today-work-heading">
            <Input
              type="checkbox"
              aria-label={
                completed
                  ? tr('Delete.reopen', { name: value.entity_snapshot.name })
                  : tr('Today.completeAllTasksInValue', { v1: value.entity_snapshot.name })
              }
              checked={completed}
              disabled={selectionLocked || locked}
              onChange={() => void run(() => toggleScheduleCompletion(value))}
            />
            <div>
              <h2 className="schedule-card-title">
                <Button
                  variant="plain"
                  className="today-work-select"
                  aria-pressed={selected}
                  disabled={selectionLocked}
                  onClick={onSelect}
                >
                  {value.entity_snapshot.name}
                </Button>
                <span className="schedule-card-time">
                  <ScheduleTimeText start={value.start_time} end={value.end_time} />
                </span>
              </h2>
              {value.end_date !== value.scheduled_date && (
                <p>
                  {value.scheduled_date} — {value.end_date}
                </p>
              )}
            </div>
          </div>
          <div className="preview-actions">
            <ScheduleCardActions
              onDelete={onDelete}
              mobileEdit
              id={value.id}
              color={value.color}
              label={value.entity_snapshot.name}
              value={value.notes}
              disabled={busy || !!editing || adding || otherAdding}
              onOpenChange={(open) => onEditing(open ? 'memo-' + value.id : undefined)}
              onSave={async (notes) => {
                await mutate(() => saveSchedule({ notes }, value.id));
              }}
            />
          </div>
        </header>
        {value.title !== value.entity_snapshot.name && <p>{value.title}</p>}
        {value.notes.trim() && (
          <p className="schedule-card-memo">{value.notes.replace(/\s+/g, ' ').trim()}</p>
        )}
        <Requirements value={value.entity_snapshot} />
        <div className="today-task-cards">
          {value.tasks.map((task) => (
            <SwipeDelete
              key={task.id}
              label={task.name_snapshot}
              disabled={busy || !!editing}
              onDelete={() => mutate(() => deleteScheduleTask(task.id))}
            >
              <section
                data-context-content
                className={`today-task-card memo-preview ${task.status === 'completed' ? 'is-complete' : ''}`}
              >
                <div className="today-task-heading">
                  <label>
                    <Input
                      className="task-check"
                      type="checkbox"
                      aria-label={tr('SavedScheduleCard.completeValue', { v1: task.name_snapshot })}
                      checked={task.status === 'completed'}
                      disabled={busy || locked || !!editing || adding || otherAdding}
                      onChange={() =>
                        void run(() =>
                          updateTask(task.id, {
                            status: task.status === 'completed' ? 'pending' : 'completed',
                          }),
                        )
                      }
                    />
                    <strong>{task.name_snapshot}</strong>
                  </label>
                  <div className="preview-actions task-hover-actions">
                    <DeleteButton
                      label={task.name_snapshot}
                      disabled={busy || !!editing}
                      onDelete={() => mutate(() => deleteScheduleTask(task.id))}
                    />
                    <MemoButton
                      draftKey={'execution:' + task.id}
                      label={task.name_snapshot}
                      value={task.execution_notes}
                      disabled={busy || locked || !!editing || adding || otherAdding}
                      onOpenChange={(open) => onEditing(open ? 'memo-' + task.id : undefined)}
                      onSave={async (execution_notes) => {
                        await mutate(() => updateTask(task.id, { execution_notes }));
                      }}
                    />
                    <Button
                      variant="ghost"
                      disabled={
                        busy ||
                        (editing !== undefined && editing !== task.id) ||
                        adding ||
                        otherAdding
                      }
                      data-context-action="edit"
                      data-context-label={tr('App.edit')}
                      aria-expanded={editing === task.id}
                      aria-label={tr('MemoEditor.editValue', { v1: task.name_snapshot })}
                      title={editing === task.id ? tr('ScheduleEditor.close') : tr('App.edit')}
                      onClick={() => onEditing(editing === task.id ? undefined : task.id)}
                    >
                      {editing === task.id ? tr('ScheduleEditor.close') : tr('App.edit')}
                    </Button>
                  </div>
                </div>
                {editing === task.id && (
                  <PresetModal
                    label={tr('MemoEditor.editValue', { v1: task.name_snapshot })}
                    onClose={() => {
                      if (!busy) onEditing(undefined);
                    }}
                  >
                    <TaskExecution
                      task={task}
                      locked={locked}
                      busy={busy}
                      mutate={mutate}
                      allowRename
                      onDelete={async () => {
                        await mutate(() => deleteScheduleTask(task.id));
                        onEditing(undefined);
                      }}
                    />
                  </PresetModal>
                )}
              </section>
            </SwipeDelete>
          ))}
        </div>
        <footer className="today-card-footer">
          {(selected || hovered || focused || adding) && (
            <>
              <Button
                variant="ghost"
                disabled={busy || locked || !!editing || otherAdding || value.tasks.length >= 100}
                aria-label={
                  adding
                    ? tr('TodayScheduleCard.closeTaskAddition')
                    : tr('TodayScheduleCard.addTask')
                }
                aria-expanded={adding}
                onClick={() => onAdding(!adding)}
              >
                <ActionIcon name={adding ? 'close' : 'plus'} />
                {adding ? tr('TodayScheduleCard.closeTaskAddition') : tr('Picker.addTask')}
              </Button>
            </>
          )}
        </footer>
        {adding && (
          <NewTaskRows
            scheduleId={value.id}
            disabled={busy || locked}
            mutate={mutate}
            initialRow
            onEmpty={() => onAdding(false)}
            existing={value.tasks.map((task) => ({
              id: task.id,
              name: task.name_template_snapshot ?? task.name_snapshot,
            }))}
          />
        )}
        {error && (
          <>
            <ErrorBox error={error} />
            <ButtonLink
              title={tr('SavedScheduleCard.enterItemDetails')}
              aria-label={tr('SavedScheduleCard.enterItemDetails')}
              className="button"
              href={'#/schedules/' + value.id}
            >
              {tr('SavedScheduleCard.enterItemDetails')}
            </ButtonLink>
          </>
        )}
      </Surface>
    </SwipeDelete>
  );
}
