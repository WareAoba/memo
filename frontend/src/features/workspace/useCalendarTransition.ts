import { useLayoutEffect, useRef, type RefObject } from 'react';

type Mode = 'day' | 'month' | 'year';
type Transition = { direction: number } | { from: Mode; to: Mode; date: string };
const pageSelector = '[data-calendar-page]';

function reducedMotion() {
  return (
    ['none', 'reduced'].includes(document.documentElement.dataset.motion ?? '') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function cell(root: HTMLElement, mode: Mode, date: string) {
  return root.querySelector<HTMLElement>(
    mode === 'year' ? `[data-month="${date.slice(0, 7)}"]` : `[data-date="${date}"]`,
  );
}

/** Keep the outgoing pixels until the destination has been laid out, then map real bounds. */
export function useCalendarTransition(root: RefObject<HTMLElement | null>, key: string) {
  const pending = useRef<{
    transition: Transition;
    bounds: DOMRect;
    origin: DOMRect;
    ghost: HTMLElement;
  } | null>(null);
  const dispose = useRef<(() => void) | null>(null);

  function prepare(transition: Transition) {
    dispose.current?.();
    pending.current?.ghost.remove();
    pending.current = null;
    const page = root.current?.querySelector<HTMLElement>(pageSelector);
    if (!page || reducedMotion() || !page.animate) return;
    const bounds = page.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const origin =
      'from' in transition
        ? (cell(page, transition.from, transition.date)?.getBoundingClientRect() ?? bounds)
        : bounds;
    // A dropdown owns a stationary clipping viewport. Both moving pages must
    // remain inside it, rather than escaping into a separate top-layer popover.
    const viewport = page.closest<HTMLElement>('[data-calendar-viewport]');
    const ghost = document.createElement('div');
    if (!viewport) ghost.className = root.current!.className;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('data-calendar-transition', '');
    ghost.setAttribute('inert', '');
    Object.assign(ghost.style, {
      position: viewport ? 'absolute' : 'fixed',
      display: 'block',
      left: viewport ? '0' : `${bounds.left}px`,
      top: viewport ? '0' : `${bounds.top}px`,
      width: viewport ? '100%' : `${bounds.width}px`,
      height: viewport ? '100%' : `${bounds.height}px`,
      margin: '0',
      padding: '0',
      border: '0',
      pointerEvents: 'none',
      zIndex: '30',
      transformOrigin: 'top left',
      overflow: 'hidden',
    });
    const copy = page.cloneNode(true) as HTMLElement;
    // Layout containers and inherited zoom must match the source, not body defaults.
    const sourceStyle = getComputedStyle(page);
    const scale = viewport ? 1 : bounds.width / (page.offsetWidth || bounds.width);
    ghost.style.fontSize = sourceStyle.fontSize;
    ghost.style.lineHeight = sourceStyle.lineHeight;
    copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    Object.assign(copy.style, {
      width: `${100 / scale}%`,
      height: `${100 / scale}%`,
      margin: '0',
      flex: 'none',
      zoom: String(scale),
    });
    ghost.append(copy);
    (viewport ?? document.body).append(ghost);
    // cloneNode does not copy scroll offsets from the visible year/day panel.
    copy.scrollTop = page.scrollTop;
    const originals = page.querySelectorAll<HTMLElement>('*');
    copy.querySelectorAll<HTMLElement>('*').forEach((element, index) => {
      element.scrollTop = originals[index]!.scrollTop;
      element.scrollLeft = originals[index]!.scrollLeft;
    });
    pending.current = { transition, bounds, origin, ghost };
  }

  useLayoutEffect(() => {
    const snapshot = pending.current;
    pending.current = null;
    const page = root.current?.querySelector<HTMLElement>(pageSelector);
    if (!snapshot) return;
    if (!page || reducedMotion()) {
      snapshot.ghost.remove();
      return;
    }
    const { transition, bounds, origin, ghost } = snapshot;
    const target = page.getBoundingClientRect();
    if (!target.width || !target.height) {
      ghost.remove();
      return;
    }
    let zoomOut = false;
    let entering: Keyframe[];
    let leaving: Keyframe[];
    if ('direction' in transition) {
      entering = [
        { transform: `translateX(${transition.direction * target.width}px)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ];
      leaving = [
        { transform: 'none', opacity: 1 },
        { transform: `translateX(${-transition.direction * bounds.width}px)`, opacity: 0 },
      ];
    } else {
      const rank = { day: 0, month: 1, year: 2 };
      const zoomIn = rank[transition.from] > rank[transition.to];
      zoomOut = !zoomIn;
      const destination =
        cell(page, transition.to, transition.date)?.getBoundingClientRect() ?? target;
      const mapped = zoomIn ? origin : destination;
      const transform = (from: DOMRect, to: DOMRect) =>
        `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
      entering = zoomIn
        ? [
            { transform: transform(target, mapped), opacity: 0.3 },
            { transform: 'none', opacity: 1 },
          ]
        : [{ opacity: 0 }, { opacity: 1 }];
      leaving = zoomIn
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: 'none', opacity: 1 },
            { transform: transform(bounds, mapped), opacity: 0 },
          ];
    }
    const style = getComputedStyle(page);
    const options = {
      fill: 'both' as const,
      duration: parseFloat(style.getPropertyValue('--motion-slow')) || 560,
      easing: style.getPropertyValue('--ease-settle').trim() || 'cubic-bezier(.22,1,.36,1)',
    };
    const incoming = page.animate(
      entering.map((frame) => ({ ...frame, transformOrigin: 'top left' })),
      options,
    );
    // Keep the shrinking page visible until it reaches its destination cell.
    leaving.splice(1, 0, { opacity: zoomOut ? 1 : 0, offset: zoomOut ? 0.75 : 0.2 });
    const outgoing = ghost.animate(
      leaving,
      zoomOut
        ? {
            ...options,
            easing: style.getPropertyValue('--ease-exit').trim() || 'cubic-bezier(.4,0,.6,1)',
          }
        : options,
    );
    const cleanup = () => {
      // Detach before cancelling: cancellation restores the outgoing pixels.
      ghost.remove();
      incoming.cancel();
      outgoing.cancel();
    };
    // Either callback may run first. Never cancel an incoming animation one frame early.
    let finished = 0;
    const finish = () => {
      if (++finished === 2) cleanup();
    };
    incoming.onfinish = finish;
    outgoing.onfinish = finish;
    dispose.current = cleanup;
    return cleanup;
  }, [key, root]);

  useLayoutEffect(
    () => () => {
      dispose.current?.();
      pending.current?.ghost.remove();
    },
    [],
  );
  return prepare;
}
