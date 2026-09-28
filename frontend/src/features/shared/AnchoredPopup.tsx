import { observeAnchoredPopover } from './anchoredPopover';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MenuSurface } from './ui';

/** Calendar-style, non-modal top-layer surface. Motion is owned by MenuSurface/usePopupState. */
export function AnchoredPopup({
  anchor,
  popupRef,
  label,
  onClose,
  children,
  width = 280,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  popupRef: RefObject<HTMLDivElement | null>;
  label: string;
  onClose: (restoreFocus?: boolean) => void;
  children: ReactNode;
  width?: number;
}) {
  const local = useRef<HTMLDivElement>(null);
  const callback = useRef(onClose);
  useLayoutEffect(() => {
    callback.current = onClose;
  });
  useLayoutEffect(() => {
    const menu = local.current!;
    const trigger = anchor.current;
    const stopPositioning = trigger
      ? observeAnchoredPopover(menu, trigger, { width, gap: 8 })
      : undefined;
    function outside(event: Event) {
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !trigger?.contains(event.target)
      )
        callback.current(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        callback.current(true);
      }
    }
    menu.querySelector<HTMLElement>('[role="listbox"]')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    menu.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      menu.removeEventListener('keydown', escape);
      stopPositioning?.();
    };
  }, [anchor, width]);
  return createPortal(
    <MenuSurface
      ref={(element) => {
        local.current = element;
        popupRef.current = element;
      }}
      popover="manual"
      role="dialog"
      aria-label={label}
      className="ui-anchored-popup"
    >
      {children}
    </MenuSurface>,
    anchor.current?.closest('dialog') ?? document.body,
  );
}
