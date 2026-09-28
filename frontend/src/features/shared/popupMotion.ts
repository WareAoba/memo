let pointer: { x: number; y: number } | undefined;

export function rememberPopupPointer(point?: { x: number; y: number }) {
  pointer = point;
}

export function motionEnabled(element: HTMLElement) {
  return (
    !!element.animate &&
    !['none', 'reduced'].includes(document.documentElement.dataset.motion ?? '') &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Called after the owner positions its popup; keyboard opens use the nearest corner. */
export function enterPopup(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  element.style.transformOrigin = pointer
    ? `${pointer.x - rect.left}px ${pointer.y - rect.top}px`
    : 'top left';
  element.style.setProperty('--popup-exit-transform', 'scale(0.04)');
  if (!motionEnabled(element)) return;
  const style = getComputedStyle(element);
  return element.animate(
    [
      { opacity: 0, transform: 'scale(0.04)' },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: parseFloat(style.getPropertyValue('--motion-medium')) || 460,
      easing: style.getPropertyValue('--ease-settle').trim() || 'ease-out',
    },
  );
}
