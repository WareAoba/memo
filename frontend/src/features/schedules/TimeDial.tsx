import { useSettings } from '../settings/settingsContext';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ActionIcon } from '../shared/ActionIcon';
import { Button } from '../shared/ui';
import { DialFace } from './DialFace';
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
  const [adjusting, setAdjusting] = useState(false);
  const [dragging, setDragging] = useState(false);
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
  const s = start ? toMinutes(start) : 0,
    e = end ? toMinutes(end) : 0;
  const duration = independentEndpoints ? Math.max(0, daySpan * 1440 + e - s) : Math.max(0, e - s);
  function update(endpoint: Endpoint, minute: number) {
    if (disabled) return endpoint;
    const value = Math.max(
      independentEndpoints && endpoint === 'end' ? step : 0,
      Math.min(1440 - step, Math.round(minute / step) * step),
    );
    if (!start || !end) {
      onChange({
        start,
        end,
        [endpoint]: toTime(endpoint === 'end' ? Math.max(step, value) : value),
      });
      return endpoint;
    }
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
    setDragging(true);
    setSelected(endpoint);
    face.current!.setPointerCapture(event.pointerId);
    if (!handle && minute !== null) update(endpoint, minute);
  }
  function finish(event: PointerEvent, cancelled = false) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
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
    <div
      className="time-dial-control"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setAdjusting(false);
      }}
    >
      <div className="time-endpoints" aria-label={tr('TimeDial.timeToAdjust')}>
        {(['start', 'end'] as const).map((endpoint) => (
          <div
            key={endpoint}
            className="time-endpoint-box"
            data-active={adjusting && selected === endpoint}
          >
            <Button
              variant="plain"
              className="time-endpoint-value"
              disabled={disabled}
              aria-pressed={adjusting && selected === endpoint}
              onClick={() => {
                setSelected(endpoint);
                setAdjusting(!(adjusting && selected === endpoint));
              }}
              onKeyDown={(event) => key(event, endpoint)}
            >
              <span className={`endpoint-dot ${endpoint}-dot`} />
              {endpoint === 'start' ? tr('TaskExecution.start') : tr('TimeDial.end')}
              <strong>{(endpoint === 'start' ? start : end) || '—'}</strong>
            </Button>
            <div
              className="time-step-reveal"
              inert={!(adjusting && selected === endpoint)}
              aria-hidden={!(adjusting && selected === endpoint)}
            >
              <div className="time-step-actions">
                <Button
                  variant="ghost"
                  disabled={disabled}
                  aria-label={tr('TimeDial.decreaseTime')}
                  onClick={() => update(endpoint, (endpoint === 'start' ? s : e) - step)}
                >
                  <ActionIcon name="down" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={disabled}
                  aria-label={tr('TimeDial.increaseTime')}
                  onClick={() => update(endpoint, (endpoint === 'start' ? s : e) + step)}
                >
                  <ActionIcon name="up" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        ref={face}
        className="time-dial"
        data-testid="time-dial"
        data-dragging={dragging}
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
          setDragging(false);
        }}
      >
        <div className="dial-daylight" aria-hidden="true" />
        <svg viewBox="0 0 360 360" aria-hidden="true">
          <DialFace />
          <g className="dial-selection-raised" visibility={start || end ? undefined : 'hidden'}>
            <circle
              cx={180}
              cy={180}
              r={138}
              visibility={start && end ? undefined : 'hidden'}
              className="dial-selection"
              style={{
                transform: `rotate(${s / 4 - 90}deg)`,
                strokeDasharray: `${(Math.min(duration, 1440) / 1440) * 2 * Math.PI * 138} ${2 * Math.PI * 138}`,
              }}
            />
            {(['start', 'end'] as const).map((endpoint) => {
              const angle = (endpoint === 'start' ? s : e) / 4;
              return (
                <g
                  key={endpoint}
                  className="dial-endpoint-orbit"
                  style={{ transform: `rotate(${angle}deg)` }}
                  visibility={(endpoint === 'start' ? start : end) ? undefined : 'hidden'}
                >
                  <circle cx={180} cy={42} r={16} fill="var(--status-upcoming)" />
                  <circle
                    cx={180}
                    cy={42}
                    r={13}
                    fill={endpoint === 'start' ? 'var(--accent)' : 'var(--dial-end)'}
                  />
                  <text
                    x={180}
                    y={46}
                    textAnchor="middle"
                    className="dial-endpoint-label"
                    style={{ transform: `rotate(${-angle}deg)` }}
                  >
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
            {!start || !end
              ? '—'
              : Math.floor(duration / 60) > 0
                ? tr('TimeDial.valueH', { v1: Math.floor(duration / 60) })
                : ''}
            {!start || !end
              ? ''
              : duration % 60
                ? tr('TimeDial.valueMin', { v1: duration % 60 })
                : duration === 0
                  ? tr('TimeDial.0Min')
                  : ''}
          </strong>
        </div>
        {(['start', 'end'] as const).map((endpoint) => {
          const angle = (endpoint === 'start' ? s : e) / 4;
          const value = endpoint === 'start' ? s : e;
          return (
            <div
              key={endpoint}
              className="dial-handle-orbit"
              style={{ transform: `rotate(${angle}deg)`, zIndex: selected === endpoint ? 3 : 2 }}
            >
              <Button
                variant="plain"
                key={endpoint}
                type="button"
                role="slider"
                className={`dial-handle ${endpoint}`}
                disabled={disabled}
                aria-label={
                  endpoint === 'start'
                    ? tr('ScheduleEditor.startTime')
                    : tr('ScheduleEditor.endTime')
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
            </div>
          );
        })}
      </div>
      <p id={hint} className="dial-hint">
        {tr('TimeDial.tapTheDialToSetTheValueTime', {
          v1: selected === 'start' ? tr('TaskExecution.start') : tr('TimeDial.end'),
        })}
        <span className="sr-only">{tr('Settings.clockKeyboard', { count: step })}</span>
        <span className="sr-only">{tr('TimeDial.midnight0000AtTheTop0600On')}</span>
      </p>
    </div>
  );
}
