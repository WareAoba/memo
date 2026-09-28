import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ActionIcon } from '../shared/ActionIcon';
import { Button, MenuOption, MenuSurface } from '../shared/ui';
import { usePopupState } from '../shared/usePopupExit';
import type { Sticky } from './stickyState';

export function StickyTray({
  notes,
  bounds,
  restore,
  add,
}: {
  notes: Sticky[];
  bounds: { width: number; height: number };
  restore: (note: Sticky) => void;
  add: () => void;
}) {
  useTranslation();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen, toggle] = usePopupState(menu);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    (first.current ? items?.[0] : items?.[items.length - 1])?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, setOpen]);
  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [
        ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
      ];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  }
  return (
    <div className="sticky-tray" ref={root}>
      {open && (
        <MenuSurface
          ref={menu}
          id={id}
          className="sticky-tray-menu"
          role="menu"
          aria-label={tr('Sticky.tray')}
          onKeyDown={keys}
          style={{
            width: Math.max(0, Math.min(320, bounds.width - 24)),
            maxHeight: Math.max(0, bounds.height - 80),
          }}
        >
          <MenuOption role="menuitem" tabIndex={-1} onClick={() => setOpen(false, add)}>
            <ActionIcon name="plus" />
            <span>{tr('Sticky.addMenu')}</span>
          </MenuOption>
          {notes.length ? (
            notes.map((note, index) => (
              <MenuOption
                key={note.id}
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpen(false, () => restore(note));
                }}
              >
                <ActionIcon name={note.kind === 'note' ? 'memo' : 'calendar'} />
                <span>
                  {note.title ||
                    note.target ||
                    note.text.slice(0, 40) ||
                    `${tr('Sticky.note')} ${index + 1}`}
                </span>
              </MenuOption>
            ))
          ) : (
            <p className="sticky-tray-empty" role="status">
              {tr('Sticky.trayEmpty')}
            </p>
          )}
        </MenuSurface>
      )}
      <Button
        iconOnly
        ref={trigger}
        className="sticky-tray-trigger"
        aria-label={tr('Sticky.tray')}
        title={tr('Sticky.tray')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          first.current = true;
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            first.current = event.key === 'ArrowDown';
            setOpen(true);
          } else if (event.key === 'Escape') setOpen(false);
        }}
      >
        <ActionIcon name="sticky" />
      </Button>
    </div>
  );
}
