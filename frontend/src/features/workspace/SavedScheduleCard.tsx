import { SwipeDelete, DeleteButton } from '../shared/SwipeDelete';
import { ScheduleCardActions } from '../shared/ScheduleCardActions';
import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input, ButtonLink } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { useRef, useState } from 'react';
import {
  updateTask,
  saveSchedule,
  deleteSchedule,
  deleteScheduleTask,
  completeSchedule,
  reopenSchedule,
} from '../../api/schedules';
import { MemoButton } from '../shared/MemoButton';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { progressOf, statusLabel } from './progress';
import type { ScheduleDetail } from '../../api/schedules';
import { Requirements } from '../works/Requirements';
import { taskTone } from './preview';

export function SavedScheduleCard({
  value,
  onChange,
  onDelete,
}: {
  value: ScheduleDetail;
  onChange?: (value: ScheduleDetail) => void;
  onDelete?: () => void;
}) {
  useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function toggle(id: string, completed: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await updateTask(id, { status: completed ? 'pending' : 'completed' });
      onChange?.(result);
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function change(operation: () => Promise<void>) {
    if (lock.current) throw new LocalizedError('SavedScheduleCard.currentlySaving');
    lock.current = true;
    setBusy(true);
    try {
      await operation();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const remove = () =>
    change(async () => {
      await deleteSchedule(value.id);
      onDelete?.();
    });
  const removeTask = (id: string) =>
    change(async () => {
      onChange?.(await deleteScheduleTask(id));
    });
  const count = progressOf([value]);
  return (
    <SwipeDelete label={value.entity_snapshot.name} onDelete={remove} disabled={busy || !onDelete}>
      <article
        className="work-block memo-preview schedule-card"
        data-schedule-color={value.color ?? 'none'}
      >
        <header className="work-block-heading">
          <Input
            type="checkbox"
            checked={value.status === 'completed'}
            disabled={busy || !onChange || value.status === 'cancelled'}
            aria-label={
              value.status === 'completed'
                ? tr('Delete.reopen', { name: value.entity_snapshot.name })
                : tr('Today.completeAllTasksInValue', { v1: value.entity_snapshot.name })
            }
            onChange={() => {
              void change(async () =>
                onChange?.(
                  await (value.status === 'completed'
                    ? reopenSchedule(value.id)
                    : completeSchedule(value.id)),
                ),
              ).catch((e) => setError(message(e)));
            }}
          />
          <div>
            <div className="work-meta">
              <span>{statusLabel(value.status)}</span>
            </div>
            <h2>
              <a href={'#/schedules/' + value.id}>{value.entity_snapshot.name}</a>
            </h2>
            {value.title !== value.entity_snapshot.name && <p>{value.title}</p>}
            <p className="work-time">
              {value.start_time} — {value.end_time}
            </p>
            {value.end_date !== value.scheduled_date && (
              <p>
                {value.scheduled_date} — {value.end_date}
              </p>
            )}
          </div>
          <div className="preview-actions">
            <ScheduleCardActions
              onDelete={onDelete ? remove : undefined}
              id={value.id}
              label={value.entity_snapshot.name}
              value={value.notes}
              disabled={busy || !onChange}
              onSave={async (notes) => {
                if (lock.current) throw new LocalizedError('SavedScheduleCard.currentlySaving');
                lock.current = true;
                setBusy(true);
                try {
                  onChange?.(await saveSchedule({ notes }, value.id));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            />
            <span
              className="work-count"
              aria-label={tr('SavedScheduleCard.valueOfValueTasksCompleted', {
                v1: count.total,
                v2: count.completed,
              })}
            >
              {count.completed}
              <span> / {count.total}</span>
            </span>
          </div>
        </header>
        <Requirements value={value.entity_snapshot} />
        {count.skipped > 0 && <p>{tr('SavedScheduleCard.skippedValue', { v1: count.skipped })}</p>}
        <div className="task-blocks">
          {value.tasks.map((task) => (
            <SwipeDelete
              key={task.id}
              label={task.name_snapshot}
              disabled={busy || !onChange}
              onDelete={() => removeTask(task.id)}
            >
              <div
                className={`task-block memo-preview task-${taskTone(task.id)}${task.status === 'completed' ? ' is-complete' : ''}`}
              >
                <Input
                  className="task-check"
                  type="checkbox"
                  aria-label={tr('SavedScheduleCard.completeValue', { v1: task.name_snapshot })}
                  checked={task.status === 'completed'}
                  disabled={!onChange || busy || value.status === 'cancelled'}
                  onChange={() => void toggle(task.id, task.status === 'completed')}
                />
                <a href={'#/schedules/' + value.id} className="task-name">
                  {task.name_snapshot}
                </a>
                <div className="task-hover-actions">
                  <DeleteButton
                    label={task.name_snapshot}
                    onDelete={() => removeTask(task.id)}
                    disabled={busy || !onChange}
                  />
                  <MemoButton
                    draftKey={'execution:' + task.id}
                    label={task.name_snapshot}
                    value={task.execution_notes}
                    disabled={busy || !onChange || value.status === 'cancelled'}
                    onSave={async (execution_notes) => {
                      if (lock.current)
                        throw new LocalizedError('SavedScheduleCard.currentlySaving');
                      lock.current = true;
                      setBusy(true);
                      try {
                        onChange?.(await updateTask(task.id, { execution_notes }));
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  />
                </div>
              </div>
            </SwipeDelete>
          ))}
        </div>
        {busy && <p role="status">{tr('Photos.saving')}</p>}
        {error && (
          <>
            <ErrorBox error={error} />
            <ButtonLink
              iconOnly
              title={tr('SavedScheduleCard.enterItemDetails')}
              aria-label={tr('SavedScheduleCard.enterItemDetails')}
              className="button"
              href={'#/schedules/' + value.id}
            >
              <ActionIcon name="edit" />
            </ButtonLink>
          </>
        )}
      </article>
    </SwipeDelete>
  );
}
