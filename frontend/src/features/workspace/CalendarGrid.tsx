import type { ScheduleDetail } from '../../api/schedules';
import { tr, locale } from '../../i18n';
import { fromDateKey } from './preview';
import { Button } from '../shared/ui';
import { calendarWeeks } from './calendarLayout';

export function CalendarGrid({
  month,
  items,
  today,
  selected,
  onSelect,
  miniature = false,
  sixWeeks = false,
}: {
  month: string;
  items: ScheduleDetail[];
  today: string;
  selected?: string;
  onSelect?: (date: string) => void;
  miniature?: boolean;
  sixWeeks?: boolean;
}) {
  const weeks = calendarWeeks(month, items);
  if (sixWeeks) while (weeks.length < 6) weeks.push({ dates: Array(7).fill(null), bars: [] });
  return (
    <span
      className={`calendar-grid${miniature ? ' is-miniature' : ''}`}
      aria-hidden={miniature || undefined}
    >
      {weeks.map(({ dates, bars }, week) => (
        <span className="calendar-week" key={week}>
          <span className="calendar-week-cells">
            {dates.map((date, column) => {
              if (!date) return <span key={column} />;
              const contents = (
                <>
                  {!miniature && <span className="day-number">{Number(date.slice(-2))}</span>}
                  {!miniature && bars.some((bar) => bar.start <= column && bar.end >= column) && (
                    <span className="calendar-mobile-count" aria-hidden="true">
                      {tr('Calendar.value', {
                        v1: bars.filter((bar) => bar.start <= column && bar.end >= column).length,
                      })}
                    </span>
                  )}
                  {!miniature &&
                    [1, 2, 3, 4].map((limit) => {
                      const hidden = bars.filter(
                        (bar) => bar.start <= column && bar.end >= column && bar.lane >= limit,
                      ).length;
                      return (
                        hidden > 0 && (
                          <span key={limit} className={`calendar-overflow overflow-${limit}`}>
                            {tr('Calendar.moreSchedules', { count: hidden })}
                          </span>
                        )
                      );
                    })}
                </>
              );
              return miniature ? (
                <span className="mini-day" data-date={date} key={date} />
              ) : (
                <Button
                  variant="plain"
                  className={`calendar-day${date === today ? ' is-today' : ''}${date === selected ? ' selected' : ''}`}
                  key={date}
                  data-date={date}
                  aria-label={tr('Calendar.valueValueSchedulesValue', {
                    v1: fromDateKey(date).toLocaleDateString(locale(), {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    }),
                    v2: date === today ? tr('Calendar.todayLabel') : '',
                    v3: bars.filter((bar) => bar.start <= column && bar.end >= column).length,
                  })}
                  aria-current={date === today ? 'date' : undefined}
                  aria-pressed={date === selected}
                  onClick={() => onSelect?.(date)}
                >
                  {contents}
                </Button>
              );
            })}
          </span>
          <span className="calendar-bars">
            {bars
              .filter((bar) => bar.lane < 4)
              .map(({ schedule, start, end, lane }) => {
                const style = { gridColumn: `${start + 1} / ${end + 2}`, gridRow: lane + 1 };
                const className = `calendar-bar lane-${lane + 1}${schedule.scheduled_date < dates[start]! ? ' continues-before' : ''}${schedule.end_date > dates[end]! ? ' continues-after' : ''}`;
                return miniature ? (
                  <span
                    key={schedule.id}
                    className={className}
                    style={style}
                    data-schedule-color={schedule.color ?? 'none'}
                  />
                ) : (
                  <a
                    key={schedule.id}
                    className={className}
                    style={style}
                    data-schedule-color={schedule.color ?? 'none'}
                    href={'#/schedules/' + schedule.id}
                    title={schedule.title || schedule.entity_snapshot.name}
                  >
                    {schedule.title || schedule.entity_snapshot.name}
                  </a>
                );
              })}
          </span>
        </span>
      ))}
    </span>
  );
}
