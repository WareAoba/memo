import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { saveSchedule, type ScheduleDetail } from '../../api/schedules';
import { ScheduleCardActions } from '../shared/ScheduleCardActions';
import { Button } from '../shared/ui';
import { TodayDial } from './TodayDial';
import { progressOf } from './progress';
import { scheduleAppearance } from './scheduleAppearance';

// Clock ticks only update the time-dependent overview, preserving the detail render boundary.
export function TodayOverview({
  today,
  timeZone,
  items,
  error,
  locked,
  onFinish,
  onEditing,
  mutate,
}: {
  today: string;
  timeZone?: string;
  items?: ScheduleDetail[];
  error: string;
  locked: boolean;
  onFinish: (item: ScheduleDetail) => Promise<void>;
  onEditing: (id: string | undefined) => void;
  mutate: (operation: () => Promise<ScheduleDetail>) => Promise<void>;
}) {
  useTranslation();
  const [now, setNow] = useState(() => new Date());
  const count = progressOf(items || []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="today-overview">
      <TodayDial today={today} timeZone={timeZone} now={now} items={items} />
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
                  disabled={locked || item.status === 'cancelled'}
                  aria-label={
                    completed
                      ? tr('Delete.reopen', { name: item.entity_snapshot.name })
                      : tr('Today.completeAllTasksInValue', { v1: item.entity_snapshot.name })
                  }
                  onClick={() => void onFinish(item)}
                >
                  <span
                    className="schedule-completion-check"
                    data-checked={completed}
                    aria-hidden="true"
                  />
                  <span className="schedule-completion-description">
                    <strong>{item.entity_snapshot.name}</strong>
                    <span>
                      {item.start_time}–{item.end_time}
                      {appearance.state !== 'completed' && <> · {appearance.label}</>}
                    </span>
                  </span>
                  <span className="schedule-completion-count">
                    {progress.completed}/{progress.total}
                  </span>
                </Button>
                <ScheduleCardActions
                  id={item.id}
                  color={item.color}
                  label={item.entity_snapshot.name}
                  value={item.notes}
                  disabled={locked}
                  onOpenChange={(open) => onEditing(open ? 'memo-' + item.id : undefined)}
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
      </section>
    </div>
  );
}
