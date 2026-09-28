import { toggleScheduleCompletion } from '../schedules/scheduleCompletion';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { ScheduleSearchControl } from '../schedules/ScheduleSearchControl';
import { LocalizedError } from '../../i18n/errors';
import { useTranslation } from 'react-i18next';
import { tr, locale } from '../../i18n';

import { deleteSchedule } from '../../api/schedules';
import { Surface } from '../shared/ui';
import { useEffect, useRef, useState } from 'react';
import { getDaySchedules, type ScheduleDetail } from '../../api/schedules';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { TodayOverview } from './TodayOverview';
import { TodayScheduleCard } from './TodayScheduleCard';
import { fromDateKey } from './preview';

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
    if (!timeZone) return;
    let controller: AbortController | undefined;
    let active = true;
    let requested = loadedRevision.current !== revision;
    loadedRevision.current = revision;
    function refresh() {
      if (
        !active ||
        lock.current ||
        rolloverPending ||
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
  async function mutate(operation: () => Promise<ScheduleDetail>) {
    if (lock.current) throw new LocalizedError('Schedules.operationUnavailable');
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
    if (lock.current) throw new LocalizedError('Schedules.operationUnavailable');
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
      await mutate(() => toggleScheduleCompletion(item));
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <section className="today-workspace">
      <WorkspaceHeader
        title={<h1>{tr('Calendar.today')}</h1>}
        tools={
          <>
            <ScheduleSearchControl />
            <p className="eyebrow">
              {fromDateKey(displayDate).toLocaleDateString(locale(), {
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          </>
        }
      />
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
      <TodayOverview
        today={displayDate}
        timeZone={timeZone}
        items={items}
        error={error}
        locked={busy || !!editing || !!adding}
        onFinish={finishSchedule}
        onEditing={setEditing}
        mutate={mutate}
      />
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
