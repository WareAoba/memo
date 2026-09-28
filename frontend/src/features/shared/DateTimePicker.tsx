import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { CalendarDatePicker } from '../workspace/CalendarDatePicker';
import { Button } from './ui';
import { AnchoredPopup } from './AnchoredPopup';
import { usePopupState } from './usePopupExit';
import { IconButton } from './IconButton';
import '../workspace/calendar.css';
import { dateInZone } from '../schedules/timeRange';
import { useSettings } from '../settings/settingsContext';

export function DatePicker({
  value,
  label,
  onChange,
  disabled = false,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  useTranslation();
  const today = dateInZone(useSettings().values.time_zone);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="date-time-field">
      <span>{label}</span>
      <Button
        ref={anchor}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {value}
      </Button>
      {open && (
        <CalendarDatePicker
          selected={value}
          today={today}
          anchor={anchor}
          onClose={() => setOpen(false)}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TimeWheel({
  label,
  value,
  count,
  onChange,
}: {
  label: string;
  value: number;
  count: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const scrolledValue = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function select(next: number) {
    clearTimeout(timer.current);
    scrolledValue.current = null;
    onChange(next);
  }
  function paintWheel() {
    const wheel = ref.current;
    if (!wheel) return;
    const position = wheel.scrollTop / 44;
    Array.from(wheel.querySelectorAll<HTMLElement>('.ui-time-wheel-number')).forEach(
      (number, index) => {
        const distance = index - position;
        const angle = Math.max(-80, Math.min(80, distance * 28));
        number.style.transform = `perspective(180px) rotateX(${-angle}deg)`;
        number.style.opacity = String(Math.max(0, 1 - Math.abs(distance) / 3));
      },
    );
  }
  useLayoutEffect(() => {
    const wheel = ref.current!;
    if (!initialized.current) {
      initialized.current = true;
      wheel.scrollTop = value * 44;
      paintWheel();
      // The parent opens its popover after this effect.
      const frame = requestAnimationFrame(() => {
        wheel.scrollTop = value * 44;
        paintWheel();
      });
      return () => cancelAnimationFrame(frame);
    }
    if (scrolledValue.current === value) {
      scrolledValue.current = null;
      return;
    }
    const reduce =
      ['none', 'reduced'].includes(document.documentElement.dataset.motion ?? '') ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    wheel.scrollTo?.({ top: value * 44, behavior: reduce ? 'instant' : 'smooth' });
  }, [value]);
  useLayoutEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div
      ref={ref}
      className="ui-time-wheel"
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${id}-${value}`}
      tabIndex={0}
      onKeyDown={(event) => {
        const next =
          event.key === 'ArrowDown'
            ? value + 1
            : event.key === 'ArrowUp'
              ? value - 1
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? count - 1
                  : undefined;
        if (next !== undefined) {
          event.preventDefault();
          select(Math.max(0, Math.min(count - 1, next)));
        }
      }}
      onScroll={() => {
        paintWheel();
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (ref.current) {
            const next = Math.max(0, Math.min(count - 1, Math.round(ref.current.scrollTop / 44)));
            scrolledValue.current = next;
            onChange(next);
          }
        }, 100);
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Button
          key={index}
          id={`${id}-${index}`}
          variant="plain"
          role="option"
          aria-selected={value === index}
          tabIndex={-1}
          onClick={() => select(index)}
        >
          <span className="ui-time-wheel-number">{String(index).padStart(2, '0')}</span>
        </Button>
      ))}
    </div>
  );
}

export function TimePicker({
  value,
  label,
  onChange,
  disabled = false,
  min = '00:00',
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
}) {
  useTranslation();
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = usePopupState(popup);
  function close(restoreFocus = true) {
    setOpen(false, () => {
      if (restoreFocus) anchor.current?.focus();
    });
  }
  const [draft, setDraft] = useState(value || min);
  const [hour, minute] = draft.split(':').map(Number);
  return (
    <div className="date-time-field">
      <span>{label}</span>
      <Button
        ref={anchor}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else {
            setDraft(value || min);
            setOpen(true);
          }
        }}
      >
        {value || '—'}
      </Button>
      {open && (
        <AnchoredPopup anchor={anchor} popupRef={popup} label={label} onClose={close}>
          <div className="ui-time-picker-heading">
            <strong>{label}</strong>
            <IconButton icon="close" onClick={() => close()}>
              {tr('PresetModal.closeDetails')}
            </IconButton>
          </div>
          <div className="ui-time-wheels">
            <TimeWheel
              label={tr('DateTime.hours')}
              value={hour!}
              count={24}
              onChange={(h) =>
                setDraft((current) => `${String(h).padStart(2, '0')}:${current.slice(3)}`)
              }
            />
            <span aria-hidden="true">:</span>
            <TimeWheel
              label={tr('DateTime.minutes')}
              value={minute!}
              count={60}
              onChange={(m) =>
                setDraft((current) => `${current.slice(0, 2)}:${String(m).padStart(2, '0')}`)
              }
            />
          </div>
          <div className="ui-time-picker-actions">
            <Button
              variant="primary"
              disabled={draft < min}
              onClick={() => {
                setOpen(false, () => {
                  onChange(draft);
                  anchor.current?.focus();
                });
              }}
            >
              {tr('DateTime.apply')}
            </Button>
          </div>
        </AnchoredPopup>
      )}
    </div>
  );
}
