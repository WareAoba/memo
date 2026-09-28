import { stickySnapshot } from './stickyMotion';
/** A visual-only snapshot bends in horizontal strips towards the actual tray button. */
export function stickyGenie(element: HTMLElement, opening: boolean): () => void {
  const motion = document.documentElement.dataset.motion;
  const host = element.closest('.sticky-layer') ?? element.parentElement;
  const tray = host?.querySelector('.sticky-tray-trigger');
  if (
    !host ||
    !tray ||
    !element.animate ||
    motion === 'none' ||
    motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
    return () => {};
  const rect = element.getBoundingClientRect();
  const target = tray.getBoundingClientRect();
  if (!rect.width || !rect.height) return () => {};
  const overlay = document.createElement('div');
  overlay.className = 'sticky-genie';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  host.append(overlay);
  const animations: Animation[] = [];
  const rows = 24;
  const rowHeight = rect.height / rows;
  const duration = parseFloat(getComputedStyle(element).getPropertyValue('--motion-slow')) || 560;
  for (let row = 0; row < rows; row++) {
    const strip = document.createElement('div');
    Object.assign(strip.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top + row * rowHeight}px`,
      width: `${rect.width}px`,
      height: `${rowHeight + 0.5}px`,
      overflow: 'hidden',
      transformOrigin: '50% 0',
    });
    const clone = stickySnapshot(element);
    Object.assign(clone.style, {
      left: '0',
      top: `${-row * rowHeight}px`,
      margin: '0',
      visibility: 'visible',
    });
    strip.append(clone);
    overlay.append(strip);
    const body = clone.querySelector('.sticky-body');
    if (body) body.scrollTop = element.querySelector('.sticky-body')?.scrollTop ?? 0;
    const frames: Keyframe[] = [];
    for (let step = 0; step <= 24; step++) {
      const time = step / 24;
      // Lower strips lead, creating a curved funnel instead of a uniform shrinking rectangle.
      const progress = Math.min(1, Math.max(0, (time - (1 - row / rows) * 0.22) / 0.78));
      const eased = progress * progress * (3 - 2 * progress);
      const dx = (target.left + target.width / 2 - rect.left - rect.width / 2) * eased;
      const dy = (target.top + target.height / 2 - rect.top - row * rowHeight) * eased;
      frames.push({
        offset: time,
        transform: `translate(${dx}px, ${dy}px) scale(${1 - eased * 0.94}, ${1 - eased * 0.98})`,
        opacity: progress > 0.9 ? (1 - progress) / 0.1 : 1,
      });
    }
    animations.push(
      strip.animate(frames, {
        duration,
        direction: opening ? 'reverse' : 'normal',
        fill: 'both',
        easing: 'ease-in-out',
      }),
    );
  }
  if (opening) element.style.visibility = 'hidden';
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    overlay.remove();
    animations.forEach((animation) => animation.cancel());
    if (opening) {
      element.style.visibility = '';
      if (element.isConnected && document.activeElement === document.body) element.focus();
    }
  };
  void Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup);
  return cleanup;
}
