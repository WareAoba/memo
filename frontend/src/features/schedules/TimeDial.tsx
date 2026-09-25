import { useSettings } from '../settings/settingsContext';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button } from '../shared/ui';
import { DialFace } from './DialFace';
import { point } from './dialGeometry';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { changeRange, pointToMinutes, toMinutes, toTime } from './timeRange';
import './schedules.css';
type Endpoint = 'start' | 'end';
type Props = {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  disabled?: boolean;
  independentEndpoints?: boolean;
  daySpan?: number;
};
export function TimeDial({
  start,
  end,
  onChange,
  disabled = false,
  independentEndpoints = false,
  daySpan = 0,
}: Props) {
  useTranslation();
  const step = useSettings().values.clock_step;
  const [selected, setSelected] = useState<Endpoint>('start');
  const drag = useRef<{
    id: number;
    endpoint: Endpoint;
    advance: boolean;
    previous: number;
    position: number;
  } | null>(null);
  const face = useRef<HTMLDivElement>(null);
  const hint = useId();
  const s = toMinutes(start),
    e = toMinutes(end);
  const a = point(s, 138),
    b = point(e, 138);
  const duration = independentEndpoints ? Math.max(0, daySpan * 1440 + e - s) : Math.max(0, e - s);
  function update(endpoint: Endpoint, minute: number) {
    if (disabled) return endpoint;
    const value = Math.max(
      independentEndpoints && endpoint === 'end' ? step : 0,
      Math.min(1440 - step, Math.round(minute / step) * step),
    );
    if (independentEndpoints) {
      onChange({ start, end, [endpoint]: toTime(value) });
      return endpoint;
    }
    const fixed = endpoint === 'start' ? e : s;
    const nextEndpoint = value === fixed ? endpoint : value < fixed ? 'start' : 'end';
    onChange(changeRange(start, end, endpoint, value, step));
    setSelected(nextEndpoint);
    if (drag.current) drag.current.endpoint = nextEndpoint;
    return nextEndpoint;
  }
  function locate(event: PointerEvent) {
    const r = face.current!.getBoundingClientRect();
    const x = ((event.clientX - r.left) / r.width) * 360 - 180;
    const y = ((event.clientY - r.top) / r.height) * 360 - 180;
    return Math.hypot(x, y) < 75 ? null : pointToMinutes(x, y, step);
  }
  function begin(event: PointerEvent, endpoint: Endpoint, handle = false) {
    if (
      disabled ||
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0) ||
      drag.current
    )
      return;
    const minute = locate(event);
    if (minute === null && !handle) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = {
      id: event.pointerId,
      endpoint,
      advance: !handle,
      previous: minute ?? (endpoint === 'start' ? s : e),
      position: handle ? (endpoint === 'start' ? s : e) : minute!,
    };
    setSelected(endpoint);
    face.current!.setPointerCapture(event.pointerId);
    if (!handle && minute !== null) update(endpoint, minute);
  }
  function finish(event: PointerEvent, cancelled = false) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (face.current?.hasPointerCapture(event.pointerId))
      face.current.releasePointerCapture(event.pointerId);
    if (!cancelled && current.advance) setSelected(current.endpoint === 'start' ? 'end' : 'start');
  }
  function key(event: KeyboardEvent, endpoint: Endpoint) {
    const value = endpoint === 'start' ? s : e;
    const next = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + 60,
      PageDown: value - 60,
      Home: 0,
      End: 1440 - step,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      const nextEndpoint = update(endpoint, next);
      if (nextEndpoint !== endpoint)
        face.current?.querySelector<HTMLButtonElement>('.dial-handle.' + nextEndpoint)?.focus();
    }
  }
  return (
    <div className="time-dial-control">
      <div className="time-endpoints" aria-label={tr('TimeDial.timeToAdjust')}>
        <Button
          variant="plain"
          type="button"
          disabled={disabled}
          aria-pressed={selected === 'start'}
          onClick={() => setSelected('start')}
        >
          <span className="endpoint-dot start-dot" />
          {tr('TaskExecution.start')}
          <strong>{start}</strong>
        </Button>
        <span aria-hidden="true">—</span>
        <Button
          variant="plain"
          type="button"
          disabled={disabled}
          aria-pressed={selected === 'end'}
          onClick={() => setSelected('end')}
        >
          <span className="endpoint-dot end-dot" />
          {tr('TimeDial.end')}
          <strong>{end}</strong>
        </Button>
      </div>
      <div
        ref={face}
        className="time-dial"
        data-testid="time-dial"
        onPointerDown={(event) => begin(event, selected)}
        onPointerMove={(event) => {
          if (drag.current?.id === event.pointerId) {
            const m = locate(event);
            if (m !== null) {
              const current = drag.current;
              let delta = m - current.previous;
              if (delta > 720) delta -= 1440;
              if (delta < -720) delta += 1440;
              current.position = Math.max(0, Math.min(1440 - step, current.position + delta));
              current.previous = m;
              update(current.endpoint, current.position);
            }
          }
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <div className="dial-daylight" aria-hidden="true" />
        <svg viewBox="0 0 360 360" aria-hidden="true">
          <DialFace />
          <g className="dial-selection-raised">
            {duration >= 1440 ? (
              <circle cx={180} cy={180} r={138} className="dial-selection" />
            ) : (
              <path
                d={`M ${a.x} ${a.y} A 138 138 0 ${duration > 720 ? 1 : 0} 1 ${b.x} ${b.y}`}
                className="dial-selection"
              />
            )}
            {(['start', 'end'] as const).map((endpoint) => {
              const p = endpoint === 'start' ? a : b;
              return (
                <g key={endpoint}>
                  <circle cx={p.x} cy={p.y} r={16} fill="var(--status-upcoming)" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={13}
                    fill={endpoint === 'start' ? 'var(--accent)' : 'var(--dial-end)'}
                  />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" className="dial-endpoint-label">
                    {endpoint === 'start' ? tr('TimeDial.s') : tr('TimeDial.e')}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="dial-center" aria-hidden="true">
          <span>{tr('TimeDial.selectedDuration')}</span>
          <strong>
            {Math.floor(duration / 60) > 0
              ? tr('TimeDial.valueH', { v1: Math.floor(duration / 60) })
              : ''}
            {duration % 60
              ? tr('TimeDial.valueMin', { v1: duration % 60 })
              : duration === 0
                ? tr('TimeDial.0Min')
                : ''}
          </strong>
        </div>
        {(['start', 'end'] as const).map((endpoint) => {
          const p = endpoint === 'start' ? a : b;
          const value = endpoint === 'start' ? s : e;
          return (
            <Button
              variant="plain"
              key={endpoint}
              type="button"
              role="slider"
              className={`dial-handle ${endpoint}`}
              style={{
                left: `${p.x / 3.6}%`,
                top: `${p.y / 3.6}%`,
                zIndex: selected === endpoint ? 3 : 2,
              }}
              disabled={disabled}
              aria-label={
                endpoint === 'start' ? tr('ScheduleEditor.startTime') : tr('ScheduleEditor.endTime')
              }
              aria-valuemin={independentEndpoints && endpoint === 'end' ? step : 0}
              aria-valuemax={1439}
              aria-valuenow={value}
              aria-valuetext={endpoint === 'start' ? start : end}
              aria-describedby={hint}
              onFocus={() => setSelected(endpoint)}
              onKeyDown={(event) => key(event, endpoint)}
              onPointerDown={(event) => begin(event, endpoint, true)}
            >
              <span className="sr-only">
                {endpoint === 'start' ? tr('TaskExecution.start') : tr('TimeDial.end')}
              </span>
            </Button>
          );
        })}
      </div>
      <details className="inline-help dial-help">
        <summary>{tr('UI.timeHelp')}</summary>
        <p id={hint} className="dial-hint">
          {tr('TimeDial.tapTheDialToSetTheValueTime', {
            v1: selected === 'start' ? tr('TaskExecution.start') : tr('TimeDial.end'),
          })}
          <br />
          {tr('Settings.clockKeyboard', { count: step })}
          <span className="sr-only">{tr('TimeDial.midnight0000AtTheTop0600On')}</span>
        </p>
      </details>
    </div>
  );
}
