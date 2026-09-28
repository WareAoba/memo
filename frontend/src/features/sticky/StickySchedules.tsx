import { ScheduleContextColor } from '../schedules/ScheduleContextColor';
import { scheduleChange } from '../../api/scheduleChanges';
import { toggleScheduleCompletion } from '../schedules/scheduleCompletion';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDaySchedules, getSchedule, updateTask, type ScheduleDetail } from '../../api/schedules';
import { tr } from '../../i18n';
import { ButtonLink, Input } from '../shared/ui';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import type { ScheduleColor } from '../../api/scheduleColors';

export function StickySchedules({
  kind,
  target,
  onColor,
}: {
  kind: 'date' | 'schedule';
  target: string;
  onColor?: (color: ScheduleColor) => void;
}) {
  useTranslation();
  const [items, setItems] = useState<ScheduleDetail[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((v) => v + 1);
    window.addEventListener('focus', changed);
    window.addEventListener('online', changed);
    return () => {
      window.removeEventListener('focus', changed);
      window.removeEventListener('online', changed);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let loaded = false;
    function changed(event: Event) {
      const change = scheduleChange(event);
      if (change && 'id' in change && kind === 'schedule' && change.id !== target) return;
      if (!loaded || !change || !('id' in change)) {
        controller.abort();
        setRevision((v) => v + 1);
        return;
      }
      controller.abort();
      if (change.kind === 'deleted') {
        setItems((old) => old.filter((item) => item.id !== change.id));
      } else {
        const value = change.schedule;
        const included =
          kind === 'schedule' || (value.scheduled_date <= target && value.end_date >= target);
        setItems((old) =>
          [...old.filter((item) => item.id !== value.id), ...(included ? [value] : [])].sort(
            (a, b) =>
              a.scheduled_date.localeCompare(b.scheduled_date) ||
              a.start_time.localeCompare(b.start_time) ||
              a.id.localeCompare(b.id),
          ),
        );
        if (kind === 'schedule') onColor?.(value.color ?? 'none');
      }
      setError('');
    }
    window.addEventListener('schedules-changed', changed);
    const load =
      kind === 'date'
        ? getDaySchedules(target, controller.signal)
        : getSchedule(target, controller.signal).then((v) => [v]);
    void load
      .then((v) => {
        if (!controller.signal.aborted) {
          loaded = true;
          setItems(v);
          if (kind === 'schedule') onColor?.(v[0]?.color ?? 'none');
          setError('');
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
      window.removeEventListener('schedules-changed', changed);
    };
  }, [kind, target, revision, onColor]);
  async function change(action: () => Promise<ScheduleDetail>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await action();
      if (kind === 'schedule') onColor?.(value.color ?? 'none');
      setItems((old) => old.map((item) => (item.id === value.id ? value : item)));
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {error && <ErrorBox error={error} retry={() => setRevision((v) => v + 1)} />}
      {loading && <p role="status">{tr('App.loadingAppSettings')}</p>}
      {!loading && !error && !items.length && <p>{tr('Sticky.empty')}</p>}
      {items.map((item) => (
        <section data-context-content className="sticky-schedule" key={item.id}>
          <ScheduleContextColor id={item.id} color={item.color} disabled={busy} />
          <div className="sticky-check-row">
            <Input
              type="checkbox"
              checked={item.status === 'completed'}
              disabled={busy || item.status === 'cancelled'}
              aria-label={tr('Sticky.complete', { name: item.title })}
              onChange={() => void change(() => toggleScheduleCompletion(item))}
            />
            <ButtonLink
              data-context-action="edit"
              data-context-label={tr('App.edit')}
              data-context-memo
              variant="ghost"
              href={'#/schedules/' + item.id}
            >
              {item.title || item.entity_snapshot.name}
            </ButtonLink>
          </div>
          {item.tasks.map((task) => (
            <label className="sticky-check-row" key={task.id}>
              <Input
                type="checkbox"
                className="task-check"
                checked={task.status === 'completed'}
                disabled={busy || item.status === 'cancelled'}
                aria-label={tr('Sticky.complete', { name: task.name_snapshot })}
                onChange={() =>
                  void change(() =>
                    updateTask(task.id, {
                      status: task.status === 'completed' ? 'pending' : 'completed',
                    }),
                  )
                }
              />
              <span>{task.name_snapshot}</span>
            </label>
          ))}
        </section>
      ))}
    </>
  );
}
