import { useTranslation } from 'react-i18next';
import { tr, locale, weekdays, monthLabel } from '../../i18n';
import { PageHeader, Button, Surface, Input, ButtonLink } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { useEffect, useState } from 'react';
import { getRangeSchedules, type ScheduleDetail } from '../../api/schedules';
import { dateKey, fromDateKey, monthDays } from './preview';
import { SavedScheduleCard } from './SavedScheduleCard';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { ScheduleSearch } from '../schedules/ScheduleSearch';

const dateLabel = (date: string) =>
  fromDateKey(date).toLocaleDateString(locale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
export type CalendarMode = 'day' | 'month' | 'year';
export function Calendar({
  today,
  mode: controlledMode,
  onModeChange,
  revision = 0,
}: {
  today: string;
  revision?: number;
  mode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
}) {
  useTranslation();
  const [localMode, setLocalMode] = useState<CalendarMode>('month');
  const mode = controlledMode ?? localMode;
  function changeMode(next: CalendarMode) {
    setLocalMode(next);
    onModeChange?.(next);
  }
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [result, setResult] = useState<{ range: string; items: ScheduleDetail[] }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const cells = monthDays(fromDateKey(month + '-01'));
  const dates = cells.filter((d): d is string => d !== null);
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const rangeStart = mode === 'year' ? month.slice(0, 4) + '-01-01' : first;
  const rangeEnd = mode === 'year' ? month.slice(0, 4) + '-12-31' : last;
  const range = `${rangeStart}/${rangeEnd}`;
  useEffect(() => {
    const controller = new AbortController();
    getRangeSchedules(rangeStart, rangeEnd, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setResult({ range, items });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [rangeStart, rangeEnd, range, attempt, revision]);
  const items = result?.range === range ? result.items : undefined;
  const onDate = (date: string) =>
    items?.filter((s) => s.scheduled_date <= date && s.end_date >= date) || [];
  const list = onDate(selected);
  function chooseMonth(next: string, date: string) {
    setError('');
    setMonth(next);
    setSelected(date);
  }
  function move(delta: number) {
    const d = fromDateKey(month + '-01');
    d.setMonth(d.getMonth() + delta);
    const next = dateKey(d);
    chooseMonth(next.slice(0, 7), next);
  }
  return (
    <section className={`calendar-workspace calendar-mode-${mode}`}>
      <PageHeader className="workspace-heading">
        <h1>{tr('Schedules.calendar')}</h1>
        <div className="calendar-heading-actions">
          <Button
            iconOnly
            variant="ghost"
            aria-label={tr('ScheduleSearch.searchSchedules')}
            title={tr('ScheduleSearch.searchSchedules')}
            onClick={() => setSearchOpen(true)}
          >
            <ActionIcon name="search" />
          </Button>
          <Button
            iconOnly
            variant="ghost"
            onClick={() => {
              setResult(undefined);
              setError('');
              setAttempt((n) => n + 1);
            }}
            aria-label={tr('Calendar.refresh')}
            title={tr('Calendar.refresh')}
          >
            <ActionIcon name="refresh" />
          </Button>
        </div>
      </PageHeader>
      {searchOpen && <ScheduleSearch onClose={() => setSearchOpen(false)} />}
      {mode === 'month' && (
        <Surface
          as="section"
          className="calendar-panel"
          aria-label={tr('Calendar.monthlyCalendar')}
        >
          <div className="calendar-controls">
            <h2 aria-live="polite">
              {fromDateKey(first).toLocaleDateString(locale(), { year: 'numeric', month: 'long' })}
            </h2>
            <div>
              <Button
                iconOnly
                variant="ghost"
                disabled={month <= '0001-01'}
                onClick={() => move(-1)}
                aria-label={tr('Calendar.previousMonth')}
              >
                <ActionIcon name="left" />
              </Button>
              <Button onClick={() => chooseMonth(today.slice(0, 7), today)}>
                {tr('Calendar.today')}
              </Button>
              <Button
                iconOnly
                variant="ghost"
                disabled={month >= '9999-12'}
                onClick={() => move(1)}
                aria-label={tr('Calendar.nextMonth')}
              >
                <ActionIcon name="right" />
              </Button>
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {weekdays().map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {cells.map((date, index) => {
              if (!date) return <span className="calendar-blank" key={'blank-' + index} />;
              const scheduled = onDate(date);
              return (
                <Button
                  variant="plain"
                  key={date}
                  className={`calendar-day${date === selected ? ' selected' : ''}${date === today ? ' is-today' : ''}`}
                  aria-pressed={date === selected}
                  aria-current={date === today ? 'date' : undefined}
                  aria-label={tr('Calendar.valueValueSchedulesValue', {
                    v1: dateLabel(date),
                    v2: date === today ? tr('Calendar.todayLabel') : '',
                    v3: scheduled.length,
                  })}
                  onClick={() => {
                    setSelected(date);
                    changeMode('day');
                  }}
                >
                  <span className="day-number">{fromDateKey(date).getDate()}</span>
                  {!!scheduled.length && (
                    <>
                      <span className="day-work-name">{scheduled[0]!.entity_snapshot.name}</span>
                      <span className="day-count">
                        {tr('Calendar.value', { v1: scheduled.length })}
                      </span>
                    </>
                  )}
                </Button>
              );
            })}
          </div>
        </Surface>
      )}
      {mode === 'year' && (
        <Surface as="section" className="year-panel" aria-label={tr('Calendar.selectMonthByYear')}>
          <div className="calendar-controls">
            <Button
              iconOnly
              variant="ghost"
              aria-label={tr('Calendar.previousYear')}
              disabled={month.slice(0, 4) === '0001'}
              onClick={() => move(-12)}
            >
              <ActionIcon name="left" />
            </Button>
            <h2>{tr('Calendar.valueLabel', { v1: Number(month.slice(0, 4)) })}</h2>
            <Button
              iconOnly
              variant="ghost"
              aria-label={tr('Calendar.nextYear')}
              disabled={month.slice(0, 4) === '9999'}
              onClick={() => move(12)}
            >
              <ActionIcon name="right" />
            </Button>
          </div>
          <p className="year-legend">
            {tr('Calendar.taskCompletion')}
            <span className="year-legend-red">0–50%</span>
            <span className="year-legend-green">60–100%</span>{' '}
            {tr('Calendar.daysWithoutTasksAreNeutral')}
          </p>
          <div className="year-months">
            {Array.from({ length: 12 }, (_, i) => {
              const next = month.slice(0, 4) + '-' + String(i + 1).padStart(2, '0');
              return (
                <Button
                  variant="plain"
                  key={next}
                  aria-label={monthLabel(i + 1, true)}
                  aria-current={next === today.slice(0, 7) ? 'date' : undefined}
                  onClick={() => {
                    chooseMonth(next, next + '-01');
                    changeMode('month');
                  }}
                >
                  <span className="year-month-heading">
                    <strong>{monthLabel(i + 1, true)}</strong>
                    {next === today.slice(0, 7) && <span>{tr('Calendar.thisMonth')}</span>}
                  </span>
                  <span className="mini-weekdays" aria-hidden="true">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <span key={index}>{day}</span>
                    ))}
                  </span>
                  <span className="mini-days">
                    {monthDays(fromDateKey(next + '-01')).map((date, index) => {
                      if (!date) return <span key={`blank-${index}`} aria-hidden="true" />;
                      const tasks = onDate(date).flatMap((schedule) => schedule.tasks);
                      const completed = tasks.filter((task) => task.status === 'completed').length;
                      const rate = tasks.length ? (completed / tasks.length) * 100 : null;
                      const label = `${dateLabel(date)}${date === today ? tr('Calendar.todayLabel') : ''}, ${!items ? tr('Calendar.loading') : rate === null ? tr('Calendar.noTasks') : tr('Calendar.valueOfValueTasksCompletedValueComplete', { v1: tasks.length, v2: completed, v3: Math.round(rate) })}`;
                      return (
                        <span
                          key={date}
                          className={`mini-day${date === today ? ' is-today' : ''}`}
                          data-date={date}
                          title={label}
                          aria-label={label}
                          style={
                            rate === null
                              ? undefined
                              : {
                                  backgroundColor:
                                    rate < 60
                                      ? `hsl(4 78% ${76 + (Math.min(rate, 50) / 50) * 14}%)`
                                      : `hsl(${145 - ((rate - 60) / 40) * 60} 58% ${79 - ((rate - 60) / 40) * 9}%)`,
                                  color: rate < 60 ? 'var(--danger)' : 'var(--success)',
                                }
                          }
                        />
                      );
                    })}
                  </span>
                </Button>
              );
            })}
          </div>
        </Surface>
      )}
      {mode === 'day' && (
        <div className="calendar-controls">
          <label>
            {tr('Calendar.selectDate')}
            <Input
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={selected}
              onChange={(event) => {
                const date = event.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '0001-01-01')
                  chooseMonth(date.slice(0, 7), date);
              }}
            />
          </label>
          <IconButton icon="calendar" onClick={() => changeMode('month')}>
            {tr('Calendar.backToMonthlyCalendar')}
          </IconButton>
        </div>
      )}
      {error && (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {!items && !error && <p role="status">{tr('Schedules.loadingSchedules')}</p>}
      {mode === 'day' && (
        <div
          className="day-detail-scroll"
          tabIndex={0}
          role="region"
          aria-label={tr('Calendar.dailyScheduleDetails')}
        >
          <div className="section-heading">
            <h2>{dateLabel(selected)}</h2>
            <ButtonLink
              iconOnly
              title={tr('Calendar.createScheduleOnThisDate')}
              aria-label={tr('Calendar.createScheduleOnThisDate')}
              className="button"
              data-modal-trigger
              href={'#/schedules/new?date=' + selected}
            >
              <ActionIcon name="plus" />
            </ButtonLink>
          </div>
          {items && (
            <>
              <p>{tr('Calendar.schedulesValueByTime', { v1: list.length })}</p>
              <div className="work-stack">
                {list.map((value) => (
                  <SavedScheduleCard
                    key={value.id}
                    value={value}
                    onDelete={() =>
                      setResult((current) =>
                        current
                          ? {
                              ...current,
                              items: current.items.filter((item) => item.id !== value.id),
                            }
                          : current,
                      )
                    }
                    onChange={(updated) =>
                      setResult((current) =>
                        current
                          ? {
                              ...current,
                              items: current.items.map((s) => (s.id === updated.id ? updated : s)),
                            }
                          : current,
                      )
                    }
                  />
                ))}
              </div>
              {!list.length && (
                <p className="empty">{tr('Calendar.noSchedulesSavedForThisDate')}</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
