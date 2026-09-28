import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Keep the live popup mounted until its exit finishes; cancel stale closes on reopen. */
export function usePopupExit(ref: RefObject<HTMLElement | null>) {
  const pending = useRef<Animation | null>(null);
  const cancel = useCallback(() => {
    const animation = pending.current;
    pending.current = null;
    animation?.cancel();
  }, []);
  useEffect(() => cancel, [cancel]);
  const close = useCallback(
    (onClosed: () => void) => {
      if (pending.current) return;
      const element = ref.current;
      const motion = document.documentElement.dataset.motion;
      if (
        !element?.animate ||
        motion === 'none' ||
        motion === 'reduced' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        onClosed();
        return;
      }
      const style = getComputedStyle(element);
      const animation = element.animate(
        [
          { opacity: style.opacity, transform: style.transform },
          {
            opacity: 0,
            transform:
              style.getPropertyValue('--popup-exit-transform').trim() ||
              'translateY(6px) scale(0.98)',
          },
        ],
        {
          duration: parseFloat(style.getPropertyValue('--motion-exit')) || 260,
          easing: style.getPropertyValue('--ease-exit').trim() || 'ease-in-out',
          fill: 'forwards',
        },
      );
      pending.current = animation;
      void animation.finished.then(
        () => {
          if (pending.current === animation) onClosed();
        },
        () => {},
      );
    },
    [ref],
  );
  return { close, cancel };
}

export function usePopupState(ref: RefObject<HTMLElement | null>) {
  const [open, updateOpen] = useState(false);
  const requested = useRef(false);
  const { close, cancel } = usePopupExit(ref);
  useLayoutEffect(() => {
    // Cancel the forwards fill only after React has removed the popup from the DOM.
    if (!open) cancel();
  }, [open, cancel]);
  const setOpen = useCallback(
    (next: boolean, onClosed?: () => void) => {
      requested.current = next;
      if (next) {
        cancel();
        updateOpen(true);
      } else
        close(() => {
          updateOpen(false);
          onClosed?.();
        });
    },
    [close, cancel],
  );
  const toggle = useCallback(() => setOpen(!requested.current), [setOpen]);
  return [open, setOpen, toggle] as const;
}
