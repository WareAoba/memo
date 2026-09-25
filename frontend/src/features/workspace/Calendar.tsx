import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { ScheduleSearchControl } from '../schedules/ScheduleSearchControl';
import { CalendarDatePicker } from './CalendarDatePicker';
import { useTranslation } from 'react-i18next';
import { tr, locale, weekdays, monthLabel } from '../../i18n';
import { Button, Surface } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { useEffect, useRef, useState } from 'react';
import { useCalendarTransition } from './useCalendarTransition';
import { CalendarGrid } from './CalendarGrid';
import './calendar.css';
import { getRangeSchedules, type ScheduleDetail } from '../../api/schedules';
import { dateKey, fromDateKey, monthDays } from './preview';
import { SavedScheduleCard } from './SavedScheduleCard';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';

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
  onSelectedDateChange,
  revision = 0,
}: {
  today: string;
  revision?: number;
  mode?: CalendarMode;
  onModeChange?: (mode: CalendarMode) => void;
  onSelectedDateChange?: (date: string) => void;
}) {
  useTranslation();
  const [localMode, setLocalMode] = useState<CalendarMode>('month');
  const mode = controlledMode ?? localMode;
  function changeMode(next: CalendarMode, date = selected) {
    if (next === mode) return;
    prepare({ from: mode, to: next, date });
    setDatePickerOpen(false);
    setLocalMode(next);
    onModeChange?.(next);
  }
  const [selected, setSelected] = useState(today);
  useEffect(() => {
    onSelectedDateChange?.(selected);
  }, [selected, onSelectedDateChange]);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [result, setResult] = useState<{ range: string; items: ScheduleDetail[] }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const dateTrigger = useRef<HTMLButtonElement>(null);
  const prepare = useCalendarTransition(panel, `${mode}:${month}:${selected}`);
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
  const loadedBounds = result?.range.split('/');
  const items =
    result && loadedBounds && loadedBounds[0]! <= rangeStart && loadedBounds[1]! >= rangeEnd
      ? result.items
      : undefined;
  const onDate = (date: string) =>
    items?.filter((s) => s.scheduled_date <= date && s.end_date >= date) || [];
  const list = onDate(selected);
  function chooseMonth(next: string, date: string) {
    setError('');
    setMonth(next);
    setSelected(date);
  }
  function move(delta: number) {
    prepare({ direction: Math.sign(delta) });
    const d = fromDateKey(month + '-01');
    d.setMonth(d.getMonth() + delta);
    const next = dateKey(d);
    chooseMonth(next.slice(0, 7), next);
  }
  function moveDay(delta: number) {
    prepare({ direction: Math.sign(delta) });
    const date = fromDateKey(selected);
    date.setDate(date.getDate() + delta);
    const next = dateKey(date);
    chooseMonth(next.slice(0, 7), next);
  }
  return (
    <section ref={panel} className={`calendar-workspace calendar-mode-${mode}`}>
      <WorkspaceHeader
        title={<h1>{tr('Schedules.calendar')}</h1>}
        navigation={
          <div
            className="preset-switch calendar-view-switch"
            role="group"
            aria-label={tr('Sidebar.calendarViews')}
          >
            {(['day', 'month', 'year'] as const).map((value) => (
              <Button
                variant="plain"
                key={value}
                aria-pressed={mode === value}
                onClick={() => changeMode(value)}
              >
                {tr(`Calendar.${value}Tab`)}
              </Button>
            ))}
          </div>
        }
        tools={<ScheduleSearchControl />}
      />
      {datePickerOpen && (
        <CalendarDatePicker
          anchor={dateTrigger}
          selected={selected}
          today={today}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(date) => {
            chooseMonth(date.slice(0, 7), date);
            setDatePickerOpen(false);
          }}
        />
      )}
      {mode === 'month' && (
        <Surface
          as="section"
          padding="compact"
          data-calendar-page
          className="calendar-panel"
          tabIndex={-1}
          aria-label={tr('Calendar.monthlyCalendar')}
        >
          <div className="calendar-controls calendar-period-heading">
            <IconButton icon="left" disabled={month <= '0001-01'} onClick={() => move(-1)}>
              {tr('Calendar.previousMonth')}
            </IconButton>
            <h2 aria-live="polite">
              {fromDateKey(first).toLocaleDateString(locale(), { year: 'numeric', month: 'long' })}
            </h2>
            <IconButton icon="right" disabled={month >= '9999-12'} onClick={() => move(1)}>
              {tr('Calendar.nextMonth')}
            </IconButton>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {weekdays().map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <CalendarGrid
            month={month}
            items={items ?? []}
            today={today}
            selected={selected}
            onSelect={(date) => {
              setSelected(date);
              changeMode('day', date);
            }}
          />
        </Surface>
      )}
      {mode === 'year' && (
        <Surface
          as="section"
          data-calendar-page
          className="year-panel"
          padding="compact"
          aria-label={tr('Calendar.selectMonthByYear')}
        >
          <div className="calendar-controls calendar-period-heading">
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
          <div className="year-months">
            {Array.from({ length: 12 }, (_, i) => {
              const next = month.slice(0, 4) + '-' + String(i + 1).padStart(2, '0');
              return (
                <Button
                  variant="plain"
                  key={next}
                  aria-label={monthLabel(i + 1, true)}
                  aria-current={next === today.slice(0, 7) ? 'date' : undefined}
                  data-month={next}
                  onClick={() => {
                    chooseMonth(next, next + '-01');
                    changeMode('month', next + '-01');
                  }}
                >
                  <span className="year-month-heading">
                    <strong>{monthLabel(i + 1, true)}</strong>
                    {next === today.slice(0, 7) && <span>{tr('Calendar.thisMonth')}</span>}
                  </span>
                  <CalendarGrid month={next} items={items ?? []} today={today} miniature />
                </Button>
              );
            })}
          </div>
        </Surface>
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
        <Surface as="section" padding="compact" data-calendar-page className="calendar-day-panel">
          <div className="calendar-controls calendar-period-heading calendar-day-heading">
            <IconButton icon="left" disabled={selected <= '0001-01-01'} onClick={() => moveDay(-1)}>
              {tr('Calendar.previousDay')}
            </IconButton>
            <div className="calendar-date-title">
              <h2 aria-live="polite">{dateLabel(selected)}</h2>
              <Button
                variant="ghost"
                ref={dateTrigger}
                onClick={() => setDatePickerOpen((open) => !open)}
                aria-haspopup="dialog"
                aria-expanded={datePickerOpen}
              >
                <ActionIcon name="calendar" />
                {tr('Calendar.selectDate')}
              </Button>
            </div>
            <IconButton icon="right" disabled={selected >= '9999-12-31'} onClick={() => moveDay(1)}>
              {tr('Calendar.nextDay')}
            </IconButton>
          </div>
          <div
            className="day-detail-scroll"
            tabIndex={0}
            role="region"
            aria-label={tr('Calendar.dailyScheduleDetails')}
          >
            <div className="section-heading">
              <h2>{tr('Calendar.schedulesValueByTime', { v1: list.length })}</h2>
            </div>
            {items && (
              <>
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
                                items: current.items.map((s) =>
                                  s.id === updated.id ? updated : s,
                                ),
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
        </Surface>
      )}
    </section>
  );
}
