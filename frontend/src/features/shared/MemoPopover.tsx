import { enterPopup } from './popupMotion';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useEffect, useLayoutEffect, type RefObject, type ReactNode } from 'react';
import { Button } from './ui';
import { ActionIcon } from './ActionIcon';
import { memoPlacement, type MemoCorner } from './memoPlacement';

export function MemoPopover({
  popupRef: ref,
  anchor,
  id,
  label,
  corner,
  onRequestClose,
  children,
}: {
  popupRef: RefObject<HTMLDivElement | null>;
  anchor: HTMLElement;
  id: string;
  label: string;
  corner: MemoCorner;
  onRequestClose: (restoreFocus?: boolean) => boolean;
  children: ReactNode;
}) {
  useTranslation();
  useLayoutEffect(() => {
    const panel = ref.current!;
    panel.showPopover?.();
    const position = () => {
      const viewport = window.visualViewport;
      const position = memoPlacement(
        anchor.getBoundingClientRect(),
        {
          width: 360,
          height: panel.scrollHeight + 2,
        },
        {
          width: viewport?.width ?? window.innerWidth,
          height: viewport?.height ?? window.innerHeight,
          left: viewport?.offsetLeft ?? 0,
          top: viewport?.offsetTop ?? 0,
        },
        corner,
      );
      Object.assign(panel.style, {
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${position.width}px`,
        maxHeight: `${position.maxHeight}px`,
      });
      panel.dataset.corner = position.corner;
    };
    position();
    const animation = enterPopup(panel);
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position);
    observer?.observe(panel);
    observer?.observe(anchor);
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    (
      panel.querySelector<HTMLElement>('textarea:not(:disabled)') ??
      panel.querySelector<HTMLElement>('button')
    )?.focus();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      panel.hidePopover?.();
      animation?.cancel();
    };
  }, [anchor, corner, ref]);
  useEffect(() => {
    let blocked = false;
    const outside = (e: PointerEvent) => {
      blocked = false;
      if (
        !(e.target instanceof Node) ||
        ref.current?.contains(e.target) ||
        anchor.contains(e.target)
      )
        return;
      if (!onRequestClose(false)) {
        blocked = true;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const click = (e: MouseEvent) => {
      if (!blocked) return;
      blocked = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onRequestClose();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor, onRequestClose, ref]);
  return (
    <div
      ref={ref}
      id={id}
      popover="manual"
      role="dialog"
      aria-label={label}
      className="memo-popover"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => e.stopPropagation()}
    >
      <header className="memo-popover-heading">
        <strong>{label}</strong>
        <Button
          iconOnly
          variant="ghost"
          aria-label={tr('MemoPopover.closeMemo')}
          onClick={() => onRequestClose()}
        >
          <ActionIcon name="close" />
        </Button>
      </header>
      {children}
    </div>
  );
}
