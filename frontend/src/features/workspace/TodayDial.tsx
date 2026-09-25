import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { scheduleAppearance } from './scheduleAppearance';
import type { ScheduleDetail } from '../../api/schedules';
import { DialFace } from '../schedules/DialFace';
import { point } from '../schedules/dialGeometry';
import { toMinutes } from '../schedules/timeRange';
import '../schedules/schedules.css';

export function TodayDial({
  today,
  timeZone,
  now,
  items,
}: {
  today: string;
  timeZone?: string;
  now: Date;
  items?: ScheduleDetail[];
}) {
  useTranslation();
  const time = timeZone
    ? now.toLocaleTimeString('en-GB', {
        timeZone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;
  const current = time ? toMinutes(time) : undefined;
  const marker = point(current ?? 0, 138);
  const handStart = point(current ?? 0, 48);
  const schedules = (items ?? []).filter(
    (item) => item.status !== 'cancelled' && item.scheduled_date <= today && item.end_date >= today,
  );
  const lanes: number[] = [];
  const heights: number[] = [];
  const ranges = schedules
    .map((item) => ({
      item,
      start: item.scheduled_date < today ? 0 : toMinutes(item.start_time),
      end: item.end_date > today ? 1440 : toMinutes(item.end_time),
    }))
    .sort((a, b) => a.start - b.start)
    .map((range) => {
      let lane = lanes.findIndex((end) => end <= range.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = range.end;
      // Stable pseudo-random heights keep adjacent arcs distinct without flicker.
      const hash = Array.from(range.item.id).reduce(
        (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
        0,
      );
      let height = hash % 5;
      if (height === heights.at(-1)) height = (height + 1) % 5;
      heights.push(height);
      return { ...range, lane, height };
    });
  return (
    <div className="today-dial-wrap">
      <div
        className="time-dial today-schedule-dial"
        role="img"
        aria-label={tr('TodayDial.todayS24HourScheduleDialValueSchedulesValue', {
          v1: time ? tr('TodayDial.nowValue', { v1: time }) : '',
          v2: schedules.length,
        })}
      >
        <div className="dial-daylight" aria-hidden="true" />
        <svg viewBox="0 0 360 360" aria-hidden="true">
          <DialFace />
          {ranges.map(({ item, start, end, lane, height }) => {
            const baseRadius =
              lanes.length === 1 ? 138 : 126 + (lane / Math.max(1, lanes.length - 1)) * 28;
            const extra = height * Math.min(2, 4 / lanes.length);
            const width = (lanes.length === 1 ? 28 : Math.max(2, 24 / lanes.length)) + extra;
            const radius = baseRadius + extra / 2;
            const appearance = scheduleAppearance(item, now);
            const circumference = 2 * Math.PI * radius;
            return (
              <g key={item.id} className="today-work-arc" data-state={appearance.state}>
                <title>
                  {tr('TodayDial.valueValueValueValueTasksValueComplete', {
                    v1: item.entity_snapshot.name,
                    v2: item.start_time,
                    v3: item.end_time,
                    v4: appearance.label,
                    v5: Math.round(appearance.ratio * 100),
                  })}
                </title>
                <circle
                  cx="180"
                  cy="180"
                  r={radius}
                  fill="none"
                  stroke={appearance.color}
                  strokeWidth={width}
                  strokeDasharray={`${((end - start) / 1440) * circumference} ${circumference}`}
                  strokeDashoffset={-(start / 1440) * circumference}
                  transform="rotate(-90 180 180)"
                />
                {appearance.state === 'overdue' && appearance.ratio > 0 && (
                  <circle
                    cx="180"
                    cy="180"
                    r={radius}
                    fill="none"
                    stroke={appearance.green}
                    strokeWidth={width}
                    strokeDasharray={`${((end - start) / 1440) * circumference * appearance.ratio} ${circumference}`}
                    strokeDashoffset={-(start / 1440) * circumference}
                    transform="rotate(-90 180 180)"
                  />
                )}
              </g>
            );
          })}
          {current !== undefined && (
            <g>
              <line
                x1={handStart.x}
                y1={handStart.y}
                x2={marker.x}
                y2={marker.y}
                stroke="var(--accent-hover)"
                strokeWidth="2"
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r="5"
                fill="var(--accent-hover)"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
        <div className="today-dial-caption">
          <span>{tr('TodayDial.currentTime')}</span>
          <strong>{time ?? '—:—'}</strong>
        </div>
      </div>
      <ul className="dial-status-legend" aria-label={tr('TodayDial.scheduleColorGuide')}>
        <li>
          <i style={{ background: 'var(--status-upcoming)' }} />
          {tr('progress.scheduled')}
        </li>
        <li>
          <i style={{ background: 'var(--status-current)' }} />
          {tr('progress.inProgress')}
        </li>
        <li>
          <i style={{ background: 'var(--status-overdue)' }} />
          {tr('ScheduleBlock.incomplete')}
        </li>
        <li>
          <i style={{ background: 'hsl(140 32% 56%)' }} />
          {tr('design-reference.completed')}
        </li>
      </ul>
      <p className="today-dial-legend">{tr('TodayDial.greenGetsDarkerAsYouCompleteMoreTasks')}</p>
    </div>
  );
}
