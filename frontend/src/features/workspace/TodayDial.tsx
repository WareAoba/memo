import { useId, useMemo } from 'react';
import { todayDialLayout, dialStrokeGeometry, dialTailFadeEnd } from './todayDialLayout';
import { TodayDialStroke } from './TodayDialStroke';
import { TodayDialSeparation } from './TodayDialSeparation';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { scheduleAppearance } from './scheduleAppearance';
import type { ScheduleDetail } from '../../api/schedules';
import { DialFace } from '../schedules/DialFace';
import { point } from '../schedules/dialGeometry';
import { timeInZone, toMinutes } from '../schedules/timeRange';
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
  const time = timeZone ? timeInZone(timeZone, now) : undefined;
  const current = time ? toMinutes(time) : undefined;
  const marker = point(current ?? 0, 138);
  const handStart = point(current ?? 0, 48);
  const filterId = useId();
  const ranges = useMemo(() => todayDialLayout(items ?? [], today), [items, today]);
  const scheduleCount = ranges.filter((range) => !range.tail).length;
  return (
    <div className="today-dial-wrap">
      <div
        className="time-dial today-schedule-dial"
        role="img"
        aria-label={tr('TodayDial.todayS24HourScheduleDialValueSchedulesValue', {
          v1: time ? tr('TodayDial.nowValue', { v1: time }) : '',
          v2: scheduleCount,
        })}
      >
        <div className="dial-daylight" aria-hidden="true" />
        <svg viewBox="0 0 360 360" aria-hidden="true">
          <defs>
            <TodayDialSeparation id={`${filterId}-separation`} ranges={ranges} />
            {[
              { name: 'blur', radius: 2.5 },
              { name: 'haze', radius: 6 },
            ].map(({ name, radius }) => (
              <filter
                key={name}
                id={`${filterId}-${name}`}
                filterUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="360"
                height="360"
              >
                <feGaussianBlur stdDeviation={radius} />
              </filter>
            ))}
          </defs>
          <DialFace />
          <g data-schedule-layer>
            {ranges
              .filter(({ item }) => item.end_time)
              .map(({ item, start, end, tail, parts }) => {
                const appearance = scheduleAppearance(item, now);
                return (
                  <g
                    key={`${item.id}-${tail ? 'tail' : 'day'}`}
                    className="today-work-arc"
                    data-state={appearance.state}
                    data-continuation={tail || undefined}
                    mask={`url(#${filterId}-separation${tail ? '-markers' : ''})`}
                  >
                    <title>
                      {tr('TodayDial.valueValueValueValueTasksValueComplete', {
                        v1: item.entity_snapshot.name,
                        v2: item.start_time,
                        v3: item.end_time,
                        v4: appearance.label,
                        v5: Math.round(appearance.ratio * 100),
                      })}
                    </title>
                    {parts.map((part) => {
                      const { radius, width } = dialStrokeGeometry(part);
                      const fadeEnd = point(dialTailFadeEnd, radius);
                      // The gradient end line follows the 01:30 radial line, so
                      // the entire stroke width (including blur) is transparent there.
                      const fadeAngle = (dialTailFadeEnd / 1440) * 2 * Math.PI;
                      const fadeLength = radius * Math.sin(fadeAngle);
                      const fadeStart = {
                        x: fadeEnd.x - Math.cos(fadeAngle) * fadeLength,
                        y: fadeEnd.y - Math.sin(fadeAngle) * fadeLength,
                      };
                      const maskId = `${filterId}-${item.id}`;
                      const completeEnd = Math.min(
                        part.end,
                        start + (end - start) * appearance.ratio,
                      );
                      const arc = (color: string, arcEnd: number) => (
                        <TodayDialStroke
                          start={part.start}
                          end={arcEnd}
                          radius={radius}
                          width={width}
                          color={color}
                        />
                      );
                      const strokes = (
                        <>
                          {arc(appearance.color, part.end)}
                          {appearance.state === 'overdue' &&
                            completeEnd > part.start &&
                            arc(appearance.green, completeEnd)}
                        </>
                      );
                      return (
                        <g key={part.start} data-lanes={part.count}>
                          {tail ? (
                            <>
                              <defs>
                                {(['sharp', 'soft', 'haze', 'fade'] as const).map((kind) => (
                                  <linearGradient
                                    key={kind}
                                    id={`${maskId}-${kind}-gradient`}
                                    gradientUnits="userSpaceOnUse"
                                    x1={fadeStart.x}
                                    y1={fadeStart.y}
                                    x2={fadeEnd.x}
                                    y2={fadeEnd.y}
                                  >
                                    {Array.from({ length: 11 }, (_, index) => {
                                      const t = index / 10;
                                      const opacity =
                                        kind === 'sharp'
                                          ? (1 - t) ** 2
                                          : kind === 'soft'
                                            ? 2 * t * (1 - t)
                                            : kind === 'haze'
                                              ? t ** 2
                                              : (1 - t) ** 2 * (1 + 2 * t);
                                      return (
                                        <stop
                                          key={index}
                                          offset={t}
                                          stopColor="white"
                                          stopOpacity={opacity}
                                        />
                                      );
                                    })}
                                  </linearGradient>
                                ))}
                                {(['sharp', 'soft', 'haze', 'fade'] as const).map((kind) => (
                                  <mask
                                    key={kind}
                                    id={`${maskId}-${kind}`}
                                    maskUnits="userSpaceOnUse"
                                    x="0"
                                    y="0"
                                    width="360"
                                    height="360"
                                  >
                                    <rect
                                      width="360"
                                      height="360"
                                      fill={`url(#${maskId}-${kind}-gradient)`}
                                    />
                                  </mask>
                                ))}
                              </defs>
                              <g mask={`url(#${maskId}-fade)`} data-tail-fade-end={dialTailFadeEnd}>
                                <g mask={`url(#${maskId}-sharp)`}>{strokes}</g>
                                <g filter={`url(#${filterId}-blur)`}>
                                  <g mask={`url(#${maskId}-soft)`}>{strokes}</g>
                                </g>
                                <g filter={`url(#${filterId}-haze)`}>
                                  <g mask={`url(#${maskId}-haze)`}>{strokes}</g>
                                </g>
                              </g>
                            </>
                          ) : (
                            strokes
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
          </g>
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
          <g data-marker-layer>
            {ranges
              .filter(({ item }) => !item.end_time)
              .map(({ item, start, end }) => (
                <g
                  key={item.id}
                  className="today-work-marker"
                  data-state={scheduleAppearance(item, now).state}
                >
                  <title>
                    {item.entity_snapshot.name} ·{' '}
                    {tr('DateTime.startOnly', { time: item.start_time })}
                  </title>
                  <TodayDialStroke
                    start={start}
                    end={end}
                    marker
                    width={4}
                    color={scheduleAppearance(item, now).color}
                  />
                </g>
              ))}
          </g>
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
          <i style={{ background: 'var(--status-completed)' }} />
          {tr('design-reference.completed')}
        </li>
      </ul>
      <p className="today-dial-legend">{tr('TodayDial.greenGetsDarkerAsYouCompleteMoreTasks')}</p>
    </div>
  );
}
