import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** One measured underline shared by link navigation and calendar view buttons. */
export function HorizontalNavigation({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = root.current!;
    const position = () => {
      const selected = element.querySelector<HTMLElement>('[aria-current], [aria-pressed="true"]');
      if (!selected || !indicator.current) return;
      indicator.current.style.width = selected.offsetWidth + 'px';
      indicator.current.style.transform = `translateX(${selected.offsetLeft}px)`;
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [children]);
  return (
    <nav
      ref={root}
      className="preset-switch calendar-view-switch ui-horizontal-navigation"
      aria-label={label}
    >
      {children}
      <span ref={indicator} className="ui-horizontal-indicator" aria-hidden="true" />
    </nav>
  );
}

/** Keep this boundary mounted so direction follows navigation, including browser history. */
export function HorizontalPage({ index, children }: { index: number; children: ReactNode }) {
  const previous = useRef(index);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const direction = Math.sign(index - previous.current);
    previous.current = index;
    const element = root.current;
    if (
      !direction ||
      !element?.animate ||
      ['none', 'reduced'].includes(document.documentElement.dataset.motion ?? '') ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const style = getComputedStyle(element);
    const animation = element.animate(
      [
        { transform: `translateX(${direction * 56}px)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: parseFloat(style.getPropertyValue('--motion-slow')) || 560,
        easing: style.getPropertyValue('--ease-settle').trim() || 'cubic-bezier(.22,1,.36,1)',
      },
    );
    return () => animation.cancel();
  }, [index]);
  return (
    <div className="ui-horizontal-page-viewport">
      <div ref={root}>{children}</div>
    </div>
  );
}
