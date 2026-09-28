import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLanguage, tr } from '../../i18n';
import { ActionIcon } from '../shared/ActionIcon';
import { Button } from '../shared/ui';
import { TimePicker } from '../shared/DateTimePicker';
import './schedules.css';

/** Shared by the clock and date-range editor; keeps one time adjustment pattern. */
export function TimeEndpoint({
  value,
  endpoint,
  labelled,
  disabled = false,
  onChange,
  onStep,
  onKeyDown,
  onSelect,
  isAllowed,
}: {
  value: string;
  endpoint: 'start' | 'end';
  labelled: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onStep: (direction: number) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onSelect?: () => void;
  isAllowed?: (value: string) => boolean;
}) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const caption = labelled ? tr(endpoint === 'start' ? 'DateTime.from' : 'DateTime.until') : '';
  const label = tr(endpoint === 'start' ? 'ScheduleEditor.startTime' : 'ScheduleEditor.endTime');
  return (
    <div
      className="time-endpoint"
      data-label-position={currentLanguage() === 'en' ? 'before' : 'after'}
    >
      {caption && (
        <span className="time-endpoint-caption">
          <span className={`endpoint-dot ${endpoint}-dot`} />
          {caption}
        </span>
      )}
      <div
        className="time-endpoint-box"
        data-active={open}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            !(
              event.relatedTarget instanceof Element &&
              event.relatedTarget.closest('[role="dialog"]')
            )
          )
            setOpen(false);
        }}
      >
        <TimePicker
          label={label}
          value={value}
          disabled={disabled}
          onChange={onChange}
          isAllowed={isAllowed}
          trigger={
            <strong className={!value ? 'time-unspecified' : undefined}>
              {value || tr('DateTime.unspecified')}
            </strong>
          }
          beforeOpen={() => {
            onSelect?.();
            if (!open) {
              setOpen(true);
              return false;
            }
            return true;
          }}
          onKeyDown={onKeyDown}
        />
        <div className="time-step-reveal" inert={!open} aria-hidden={!open}>
          <div className="time-step-content">
            <div className="time-step-actions">
              <Button
                variant="ghost"
                disabled={disabled}
                aria-label={tr('TimeDial.decreaseTime')}
                onClick={() => onStep(-1)}
              >
                <ActionIcon name="down" />
              </Button>
              <Button
                variant="ghost"
                disabled={disabled}
                aria-label={tr('TimeDial.increaseTime')}
                onClick={() => onStep(1)}
              >
                <ActionIcon name="up" />
              </Button>
            </div>
            {value && (
              <Button
                variant="ghost"
                className="time-endpoint-clear"
                disabled={disabled}
                onClick={(event) => {
                  event.currentTarget
                    .closest('.time-endpoint-box')
                    ?.querySelector<HTMLButtonElement>('.time-endpoint-value')
                    ?.focus();
                  onChange('');
                }}
              >
                {tr('DateTime.clear')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
