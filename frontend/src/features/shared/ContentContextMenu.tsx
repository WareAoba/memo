import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ActionIcon } from './ActionIcon';
import { MenuOption, MenuSurface } from './ui';
import { usePopupExit } from './usePopupExit';
import './content-context-menu.css';
import { rememberPopupPointer } from './popupMotion';

const boundary = '[data-context-content]';
const icons = {
  edit: 'edit',
  memo: 'memo',
  trash: 'trash',
  sticky: 'memo',
  open: 'open',
  minimize: 'down',
  close: 'close',
} as const;
type Action = { target: HTMLElement; kind: keyof typeof icons; label: string };
type Menu = { source: HTMLElement; actions: Action[]; slot?: HTMLElement; x: number; y: number };

function available(target: HTMLElement) {
  return (
    target.isConnected &&
    !target.matches(':disabled, [aria-disabled="true"]') &&
    !target.closest('[inert]')
  );
}

/** Explicit opt-in bridge to existing controls. No domain writes or duplicate action handlers. */
function menuFor(target: EventTarget | null, x: number, y: number): Menu | undefined {
  if (
    !(target instanceof Element) ||
    target.closest('input, textarea, select, [contenteditable="true"], [data-context-ignore]')
  )
    return;
  const source = target.closest<HTMLElement>(boundary);
  if (!source) return;
  const actions = Array.from(source.querySelectorAll<HTMLElement>('[data-context-action]'))
    .filter((element) => element.closest(boundary) === source && available(element))
    .flatMap((element): Action[] => {
      const kind = element.dataset.contextAction as keyof typeof icons;
      if (!(kind in icons)) return [];
      const entries: Action[] = [
        {
          target: element,
          kind,
          label:
            element.dataset.contextLabel ||
            element.getAttribute('aria-label') ||
            element.textContent?.trim() ||
            tr('App.edit'),
        },
      ];
      if (element.hasAttribute('data-context-memo'))
        entries.push({ target: element, kind: 'memo', label: tr('ContextMenu.memo') });
      return entries;
    });
  if (source.matches('[data-context-action]') && available(source)) {
    actions.unshift({ target: source, kind: 'open', label: tr('ContextMenu.open') });
  }
  const order = ['open', 'edit', 'memo', 'sticky', 'minimize', 'close', 'trash'];
  actions.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const slot = Array.from(source.querySelectorAll<HTMLElement>('[data-context-slot]')).find(
    (element) => element.closest(boundary) === source && available(element),
  );
  return actions.length || slot ? { source, actions, slot, x, y } : undefined;
}

export function ContentContextMenu() {
  useTranslation();
  const [menu, setMenu] = useState<Menu>();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touch: { x: number; y: number; id: number } | undefined;
    let suppressClickUntil = 0;
    const cancel = () => {
      clearTimeout(timer);
      touch = undefined;
    };
    const release = () => {
      cancel();
      if (suppressClickUntil === Infinity) suppressClickUntil = Date.now() + 700;
    };
    const context = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      rememberPopupPointer({ x: event.clientX, y: event.clientY });
      cancel();
      if (Date.now() < suppressClickUntil) return;
      setMenu(menuFor(event.target, event.clientX, event.clientY));
    };
    const down = (event: PointerEvent) => {
      rememberPopupPointer({ x: event.clientX, y: event.clientY });
      cancel();
      if (event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      const next = menuFor(event.target, event.clientX, event.clientY);
      if (!next) return;
      touch = { x: event.clientX, y: event.clientY, id: event.pointerId };
      timer = setTimeout(() => {
        suppressClickUntil = Infinity;
        setMenu(next);
        touch = undefined;
      }, 550);
    };
    const move = (event: PointerEvent) => {
      if (
        touch &&
        (event.pointerId !== touch.id ||
          Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10)
      )
        cancel();
    };
    const mouse = (event: MouseEvent) => {
      if (
        event.button === 1 ||
        (event.type === 'click' && event.detail !== 0 && Date.now() < suppressClickUntil)
      ) {
        // The menu's deliberate selection is allowed after the original touch release.
        if (event.button !== 1 && (event.target as Element)?.closest?.('.content-context-menu'))
          return;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const key = (event: KeyboardEvent) => {
      rememberPopupPointer();
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      event.preventDefault();
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setMenu(menuFor(event.target, rect.left + 16, rect.bottom));
    };
    const dismiss = () => {
      cancel();
      suppressClickUntil = 0;
      setMenu(undefined);
    };
    const scroll = (event: Event) => {
      cancel();
      if (!(event.target instanceof Element) || !event.target.closest('.content-context-menu'))
        setMenu(undefined);
    };
    document.addEventListener('contextmenu', context, true);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    document.addEventListener('mousedown', mouse, true);
    document.addEventListener('auxclick', mouse, true);
    document.addEventListener('click', mouse, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('hashchange', dismiss);
    window.addEventListener('blur', dismiss);
    window.addEventListener('resize', dismiss);
    return () => {
      cancel();
      document.removeEventListener('contextmenu', context, true);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      document.removeEventListener('mousedown', mouse, true);
      document.removeEventListener('auxclick', mouse, true);
      document.removeEventListener('click', mouse, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('hashchange', dismiss);
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('resize', dismiss);
    };
  }, []);
  return menu ? (
    <ContextOverlay key={`${menu.x}:${menu.y}`} menu={menu} onClose={() => setMenu(undefined)} />
  ) : null;
}

function ContextOverlay({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { close } = usePopupExit(panel);
  const slotHost = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = menu.slot;
    slot?.dispatchEvent(new CustomEvent('context-menu-slot', { detail: slotHost.current }));
    return () => {
      slot?.dispatchEvent(new CustomEvent('context-menu-slot', { detail: null }));
    };
  }, [menu.slot]);
  const closing = useRef(false);
  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    close(onClose);
  };
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    function position() {
      const rect = { width: panel.current!.offsetWidth, height: panel.current!.offsetHeight };
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0,
        top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth,
        height = viewport?.height ?? window.innerHeight;
      const x = Math.max(left + 8, Math.min(menu.x, left + width - rect.width - 8));
      const y = Math.max(top + 8, Math.min(menu.y, top + height - rect.height - 8));
      Object.assign(panel.current!.style, {
        left: `${x}px`,
        top: `${y}px`,
        transformOrigin: `${menu.x - x}px ${menu.y - y}px`,
      });
    }
    position();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position);
    observer?.observe(panel.current!);
    panel.current!.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      observer?.disconnect();
      element.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [menu]);
  useEffect(() => {
    const element = dialog.current!;
    const keys = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        if (!closing.current) {
          closing.current = true;
          close(onClose);
        }
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(
        panel.current!.querySelectorAll<HTMLElement>(
          '[role="menuitem"], input[type=radio]:checked:not(:disabled)',
        ),
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    element.addEventListener('keydown', keys);
    return () => element.removeEventListener('keydown', keys);
  }, [close, onClose]);
  return createPortal(
    <dialog
      ref={dialog}
      className="content-context-overlay"
      aria-label={tr('ContextMenu.title')}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <MenuSurface
        ref={panel}
        role="menu"
        aria-label={tr('ContextMenu.title')}
        className="content-context-menu"
      >
        {menu.slot && <div ref={slotHost} className="context-menu-palette" role="presentation" />}
        {menu.actions.map((action, index) => (
          <MenuOption
            key={index}
            role="menuitem"
            data-danger={action.kind === 'trash' || undefined}
            onClick={() => {
              if (closing.current) return;
              closing.current = true;
              close(() => {
                // Leave the modal top layer before invoking the original control.
                dialog.current?.close();
                flushSync(onClose);
                if (available(action.target)) action.target.click();
              });
            }}
          >
            <ActionIcon name={icons[action.kind]} />
            <span>{action.label}</span>
          </MenuOption>
        ))}
      </MenuSurface>
    </dialog>,
    document.body,
  );
}
