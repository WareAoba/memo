import { ScheduleCardActions } from '../shared/ScheduleCardActions';
import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr, locale } from '../../i18n';
import { ActionIcon } from '../shared/ActionIcon';

import { saveSchedule, deleteSchedule, reopenSchedule } from '../../api/schedules';
import { PageHeader, ButtonLink, Button, Surface } from '../shared/ui';
import { useEffect, useRef, useState } from 'react';
import { completeSchedule, getDaySchedules, type ScheduleDetail } from '../../api/schedules';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { TodayDial } from './TodayDial';
import { TodayScheduleCard } from './TodayScheduleCard';
import { progressOf } from './progress';
import { fromDateKey } from './preview';
import { scheduleAppearance } from './scheduleAppearance';

export function Today({
  today,
  timeZone,
  revision = 0,
}: {
  today: string;
  timeZone?: string;
  revision?: number;
}) {
  useTranslation();
  const [result, setResult] = useState<{ date: string; items: ScheduleDetail[] }>();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState<string>();
  const [selected, setSelected] = useState<string>();
  // Keep the current editing session mounted across an automatic date change.
  const displayDate = result && (editing || adding || busy) ? result.date : today;
  const rolloverPending = displayDate !== today;
  const lock = useRef(false);
  const generation = useRef(0);
  const loadedRevision = useRef<number | undefined>(undefined);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!timeZone) return;
    let controller: AbortController | undefined;
    let active = true;
    let requested = loadedRevision.current !== revision;
    loadedRevision.current = revision;
    function refresh() {
      if (
        !active ||
        lock.current ||
        (!requested && (editing || adding || document.visibilityState === 'hidden'))
      )
        return;
      requested = false;
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      const version = generation.current;
      getDaySchedules(today, request.signal)
        .then((items) => {
          if (active && !request.signal.aborted && generation.current === version) {
            setResult({ date: today, items });
            setError('');
          }
        })
        .catch((e) => {
          if (active && !request.signal.aborted && generation.current === version)
            setError(message(e));
        });
    }
    function changed() {
      requested = true;
      refresh();
    }
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('schedules-changed', changed);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('schedules-changed', changed);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [today, timeZone, attempt, editing, adding, revision, rolloverPending]);
  const items = result?.date === displayDate ? result.items : undefined;
  const count = progressOf(items || []);
  async function mutate(operation: () => Promise<ScheduleDetail>) {
    if (lock.current) throw new LocalizedError('Schedules.savingIsInProgressTryAgainShortly');
    lock.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    try {
      const updated = await operation();
      setResult((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === updated.id ? updated : item)),
            }
          : current,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (lock.current) throw new LocalizedError('Schedules.savingIsInProgressTryAgainShortly');
    lock.current = true;
    generation.current++;
    setBusy(true);
    try {
      await deleteSchedule(id);
      setResult((current) =>
        current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function finishSchedule(item: ScheduleDetail) {
    try {
      await mutate(() =>
        item.status === 'completed' ? reopenSchedule(item.id) : completeSchedule(item.id),
      );
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <section className="today-workspace">
      <PageHeader className="workspace-heading">
        <div>
          <p className="eyebrow">
            {fromDateKey(displayDate).toLocaleDateString(locale(), {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
          <h1>{tr('Calendar.today')}</h1>
        </div>
        <ButtonLink
          iconOnly
          variant="primary"
          className="add-work-icon"
          data-modal-trigger
          href={'#/schedules/new?date=' + today}
          aria-label={tr('App.addSchedule')}
          title={tr('App.addSchedule')}
        >
          <ActionIcon name="calendar-add" />
        </ButtonLink>
      </PageHeader>
      {rolloverPending && <p role="status">{tr('Today.theDateHasChangedSaveYourInputAndClose')}</p>}
      {error && (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        />
      )}
      <div className="today-overview">
        <TodayDial today={displayDate} timeZone={timeZone} now={now} items={items} />
        <section className="today-schedule-list" aria-label={tr('Today.todaySScheduleList')}>
          <div className="section-heading">
            <h2>{tr('Today.summary')}</h2>
            <span>{tr('Calendar.value', { v1: items?.length ?? 0 })}</span>
          </div>
          {!items && !error && (
            <p role="status">
              {timeZone ? tr('Today.loadingTodaySSchedules') : tr('App.loadingAppSettings')}
            </p>
          )}
          <div className="schedule-completion-list">
            {items?.map((item) => {
              const appearance = scheduleAppearance(item, now);
              const completed = item.status === 'completed';
              const progress = progressOf([item]);
              return (
                <div key={item.id} className="completion-preview memo-preview schedule-card">
                  <Button
                    variant="plain"
                    key={item.id}
                    className="schedule-completion-row"
                    disabled={busy || !!editing || !!adding || item.status === 'cancelled'}
                    aria-label={
                      completed
                        ? tr('Delete.reopen', { name: item.entity_snapshot.name })
                        : tr('Today.completeAllTasksInValue', { v1: item.entity_snapshot.name })
                    }
                    onClick={() => void finishSchedule(item)}
                  >
                    <span className="schedule-completion-check" aria-hidden="true">
                      {completed ? '✓' : ''}
                    </span>
                    <span className="schedule-completion-description">
                      <strong>{item.entity_snapshot.name}</strong>
                      <span>
                        {item.start_time}–{item.end_time} · {appearance.label}
                      </span>
                    </span>
                    <span className="schedule-completion-count">
                      {progress.completed}/{progress.total}
                    </span>
                    <i
                      className="work-state-dot"
                      style={{ background: appearance.color }}
                      aria-hidden="true"
                    />
                  </Button>
                  <ScheduleCardActions
                    id={item.id}
                    label={item.entity_snapshot.name}
                    value={item.notes}
                    disabled={busy || !!editing || !!adding}
                    onOpenChange={(open) => setEditing(open ? 'memo-' + item.id : undefined)}
                    onSave={async (notes) => {
                      await mutate(() => saveSchedule({ notes }, item.id));
                    }}
                  />
                </div>
              );
            })}
          </div>
          {items && (
            <div className="today-progress">
              <span aria-label={tr('Today.todaySTaskProgress')}>
                {tr('Today.tasksValueValueCompletedValueSkipped', {
                  v1: count.completed,
                  v2: count.total,
                  v3: count.skipped,
                })}
              </span>
            </div>
          )}
          {busy && <p role="status">{tr('Photos.saving')}</p>}
        </section>
      </div>
      <div
        className="today-detail-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr('Today.todaySDetailedSummary')}
      >
        <div className="section-heading">
          <h2>{tr('Today.todaySSchedules')}</h2>
        </div>
        <div className="today-schedule-cards">
          {items?.map((value) => (
            <TodayScheduleCard
              key={value.id}
              value={value}
              selected={selected === value.id}
              onSelect={() => setSelected(selected === value.id ? undefined : value.id)}
              busy={busy}
              editing={editing}
              onEditing={setEditing}
              adding={adding === value.id}
              onAdding={(open) => setAdding(open ? value.id : undefined)}
              otherAdding={!!adding && adding !== value.id}
              mutate={mutate}
              onDelete={() => remove(value.id)}
            />
          ))}
        </div>
        {items && !items.length && (
          <Surface as="section" className="empty">
            <h2>{tr('Today.noSchedulesSavedForToday')}</h2>
            <p>{tr('Today.addAScheduleWithTheButtonAtTheTop')}</p>
          </Surface>
        )}
      </div>
    </section>
  );
}
