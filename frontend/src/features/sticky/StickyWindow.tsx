import { useTranslation } from 'react-i18next';
import { useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { stickyAppear } from './stickyMotion';
import { stickyGenie } from './stickyGenie';
import { tr } from '../../i18n';
import { Button, Textarea } from '../shared/ui';
import { StickySchedules } from './StickySchedules';
import { fitSticky, resizeSticky, type Sticky } from './stickyState';
import { ActionIcon } from '../shared/ActionIcon';
import type { ScheduleColor } from '../../api/scheduleColors';

export function StickyWindow({
  note,
  bounds,
  update,
  focus,
  active = false,
  fromTray = false,
}: {
  note: Sticky;
  bounds: { width: number; height: number };
  update: (value: Sticky) => void;
  focus: () => void;
  active?: boolean;
  fromTray?: boolean;
}) {
  useTranslation();
  const windowRef = useRef<HTMLElement>(null);
  const openingFromTray = useRef(fromTray);
  useLayoutEffect(() => {
    if (!windowRef.current) return;
    return openingFromTray.current
      ? stickyGenie(windowRef.current, true)
      : stickyAppear(windowRef.current);
  }, []);
  const shown = fitSticky(note, bounds.width, bounds.height);
  const [color, setColor] = useState<ScheduleColor>('none');
  const gesture = useRef<{ x: number; y: number; note: Sticky; resize: boolean } | null>(null);
  function start(e: PointerEvent<HTMLButtonElement>, resize: boolean) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { x: e.clientX, y: e.clientY, note: shown, resize };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    update(
      g.resize
        ? resizeSticky(g.note, dx, dy, bounds)
        : fitSticky({ ...g.note, x: g.note.x + dx, y: g.note.y + dy }, bounds.width, bounds.height),
    );
  }
  function keyboard(e: KeyboardEvent<HTMLButtonElement>, resize: boolean) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const dx = e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0;
    const dy = e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0;
    update(
      resize
        ? resizeSticky(shown, dx, dy, bounds)
        : fitSticky({ ...shown, x: shown.x + dx, y: shown.y + dy }, bounds.width, bounds.height),
    );
  }
  const title = note.title || (note.kind === 'date' ? note.target : tr('Sticky.name'));
  return (
    <section
      data-context-content
      ref={windowRef}
      className="sticky-window"
      id={'sticky-' + note.id}
      tabIndex={-1}
      data-sticky-active={active}
      data-schedule-color={color}
      aria-label={title}
      onPointerDownCapture={focus}
      onFocusCapture={focus}
      style={{
        left: shown.x,
        top: shown.y,
        width: shown.width,
        height: shown.height,
      }}
    >
      <header className="sticky-heading">
        <Button
          variant="plain"
          data-context-ignore
          className="sticky-drag"
          aria-label={tr('Sticky.move', { name: title })}
          title={tr('Sticky.moveHelp')}
          onPointerDown={(e) => start(e, false)}
          onPointerMove={move}
          onPointerUp={() => {
            gesture.current = null;
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
          onKeyDown={(e) => keyboard(e, false)}
        />
        <Button
          variant="ghost"
          iconOnly
          className="sticky-control"
          data-context-action="minimize"
          aria-label={tr('Sticky.minimize')}
          title={tr('Sticky.minimize')}
          onClick={() => {
            if (windowRef.current) stickyGenie(windowRef.current, false);
            update({ ...note, state: 'minimized' });
          }}
        >
          <svg
            className="action-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M6 12h12" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          iconOnly
          className="sticky-control"
          data-context-action="close"
          aria-label={tr('Sticky.close')}
          title={tr('Sticky.close')}
          onClick={() => update({ ...note, state: 'closed' })}
        >
          <ActionIcon name="close" />
        </Button>
      </header>
      {note.state === 'open' && (
        <>
          <div className="sticky-body">
            {note.kind === 'note' ? (
              <>
                <Textarea
                  style={{ resize: 'none' }}
                  aria-label={tr('Sticky.note')}
                  placeholder={tr('Sticky.note')}
                  maxLength={20000}
                  value={note.text}
                  onChange={(e) => update({ ...note, text: e.target.value })}
                />
              </>
            ) : (
              <StickySchedules kind={note.kind} target={note.target} onColor={setColor} />
            )}
          </div>
          <Button
            variant="plain"
            data-context-ignore
            className="sticky-resize"
            aria-label={tr('Sticky.resize')}
            title={tr('Sticky.resizeHelp')}
            onPointerDown={(e) => start(e, true)}
            onPointerMove={move}
            onPointerUp={() => {
              gesture.current = null;
            }}
            onPointerCancel={() => {
              gesture.current = null;
            }}
            onKeyDown={(e) => keyboard(e, true)}
          >
            <svg
              className="action-icon"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M18 10l-8 8M18 16l-2 2" />
            </svg>
          </Button>
        </>
      )}
    </section>
  );
}
