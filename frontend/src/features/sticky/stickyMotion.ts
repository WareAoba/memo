import { motionEnabled } from '../shared/popupMotion';

/** Snapshot only: never retains IDs, focus, or interactive controls. */
export function stickySnapshot(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  element
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
    .forEach((source, index) => {
      const copy = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      )[index];
      if (copy) copy.value = source.value;
    });
  return clone;
}

export function stickyAppear(element: HTMLElement) {
  if (!motionEnabled(element)) return;
  const style = getComputedStyle(element);
  const animation = element.animate(
    [
      { opacity: 0, transform: 'translateY(12px) scale(0.94)' },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: parseFloat(style.getPropertyValue('--motion-medium')) || 460,
      easing: style.getPropertyValue('--ease-settle').trim() || 'ease-out',
    },
  );
  return () => animation.cancel();
}

/** Remove persisted state immediately; only an inert snapshot remains for the exit. */
export function stickyDismiss(element: HTMLElement) {
  if (!motionEnabled(element)) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const host = element.closest('.sticky-layer') ?? element.parentElement;
  if (!host) return;
  const overlay = document.createElement('div');
  overlay.className = 'sticky-genie sticky-dismiss';
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
  const clone = stickySnapshot(element);
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    visibility: 'visible',
    margin: '0',
  });
  overlay.append(clone);
  host.append(overlay);
  const body = clone.querySelector('.sticky-body');
  if (body) body.scrollTop = element.querySelector('.sticky-body')?.scrollTop ?? 0;
  const style = getComputedStyle(element);
  const animation = clone.animate(
    [
      { opacity: style.opacity, transform: 'none' },
      { opacity: 0, transform: 'translateY(12px) scale(0.94)' },
    ],
    {
      duration: parseFloat(style.getPropertyValue('--motion-exit')) || 260,
      easing: style.getPropertyValue('--ease-exit').trim() || 'ease-in',
      fill: 'forwards',
    },
  );
  const cleanup = () => {
    overlay.remove();
    animation.cancel();
  };
  void animation.finished.then(cleanup, cleanup);
}
