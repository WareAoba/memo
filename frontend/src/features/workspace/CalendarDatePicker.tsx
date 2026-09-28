import { observeAnchoredPopover } from '../shared/anchoredPopover';
import { useTranslation } from 'react-i18next';
import { usePopupExit } from '../shared/usePopupExit';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { tr, locale, weekdays } from '../../i18n';
import { Button, MenuSurface } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { CalendarGrid } from './CalendarGrid';
import { dateKey, fromDateKey } from './preview';
import { useCalendarTransition } from './useCalendarTransition';

export function CalendarDatePicker({
  selected,
  today,
  onSelect,
  onClose,
  anchor,
}: {
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  anchor: RefObject<HTMLButtonElement | null>;
}) {
  useTranslation();
  const [month, setMonth] = useState(selected.slice(0, 7));
  const popup = useRef<HTMLDivElement>(null);
  const { close } = usePopupExit(popup);
  const callbacks = useRef({ onClose });
  useLayoutEffect(() => {
    callbacks.current = { onClose };
  });
  const prepare = useCalendarTransition(popup, month);
  useLayoutEffect(() => {
    const menu = popup.current!;
    const trigger = anchor.current;
    const stopPositioning = trigger
      ? observeAnchoredPopover(menu, trigger, { width: 420, gap: 8, align: 'center' })
      : undefined;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !trigger?.contains(event.target)
      )
        close(() => callbacks.current.onClose());
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(() => callbacks.current.onClose());
        trigger?.focus();
      }
    }
    function focusAway(event: FocusEvent) {
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !trigger?.contains(event.target)
      )
        close(() => callbacks.current.onClose());
    }
    menu.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', focusAway);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', focusAway);
      stopPositioning?.();
    };
  }, [anchor, close]);
  function select(date: string) {
    close(() => {
      onSelect(date);
      anchor.current?.focus();
    });
  }
  function move(delta: number) {
    prepare({ direction: delta });
    const date = fromDateKey(month + '-01');
    date.setMonth(date.getMonth() + delta);
    setMonth(dateKey(date).slice(0, 7));
  }
  return createPortal(
    <MenuSurface
      ref={popup}
      popover="manual"
      role="dialog"
      aria-label={tr('Calendar.selectDate')}
      className="calendar-date-picker"
    >
      <div className="calendar-controls calendar-period-heading">
        <IconButton icon="left" disabled={month === '0001-01'} onClick={() => move(-1)}>
          {tr('Calendar.previousMonth')}
        </IconButton>
        <h2 aria-live="polite">
          {fromDateKey(month + '-01').toLocaleDateString(locale(), {
            year: 'numeric',
            month: 'long',
          })}
        </h2>
        <IconButton icon="right" disabled={month === '9999-12'} onClick={() => move(1)}>
          {tr('Calendar.nextMonth')}
        </IconButton>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays().map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-picker-viewport" data-calendar-viewport>
        <div className="calendar-picker-page" data-calendar-page>
          <CalendarGrid
            month={month}
            items={[]}
            today={today}
            selected={selected}
            onSelect={select}
            sixWeeks
          />
        </div>
      </div>
      <Button variant="ghost" onClick={() => select(today)}>
        {tr('Calendar.today')}
      </Button>
    </MenuSurface>,
    anchor.current?.closest('dialog') ?? document.body,
  );
}
