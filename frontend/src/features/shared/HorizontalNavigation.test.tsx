import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HorizontalNavigation, HorizontalPage } from './HorizontalNavigation';

it('keeps one indicator and remeasures it when the selected link changes', () => {
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(90);
  const left = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.textContent === 'Tasks' ? 90 : 0;
  });
  const view = (tasks: boolean) => (
    <HorizontalNavigation label="Presets">
      <a href="#works" aria-current={!tasks ? 'page' : undefined}>
        Works
      </a>
      <a href="#tasks" aria-current={tasks ? 'page' : undefined}>
        Tasks
      </a>
    </HorizontalNavigation>
  );
  try {
    const { container, rerender } = render(view(false));
    const indicator = container.querySelector<HTMLElement>('.ui-horizontal-indicator')!;
    expect(indicator.style.transform).toBe('translateX(0px)');
    rerender(view(true));
    expect(container.querySelector('.ui-horizontal-indicator')).toBe(indicator);
    expect(indicator.style.transform).toBe('translateX(90px)');
    expect(indicator.style.width).toBe('90px');
  } finally {
    width.mockRestore();
    left.mockRestore();
  }
});

it('slides in both directions, cancels interrupted motion, and skips reduced motion', () => {
  const original = HTMLElement.prototype.animate;
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
  HTMLElement.prototype.animate = animate;
  try {
    const { rerender, unmount } = render(<HorizontalPage index={0}>Works</HorizontalPage>);
    expect(animate).not.toHaveBeenCalled();
    rerender(<HorizontalPage index={1}>Tasks</HorizontalPage>);
    expect(animate).toHaveBeenLastCalledWith(
      [
        { transform: 'translateX(56px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      expect.any(Object),
    );
    rerender(<HorizontalPage index={0}>Works</HorizontalPage>);
    expect(cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenLastCalledWith(
      [
        { transform: 'translateX(-56px)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      expect.any(Object),
    );
    document.documentElement.dataset.motion = 'reduced';
    animate.mockClear();
    rerender(<HorizontalPage index={1}>Tasks</HorizontalPage>);
    expect(animate).not.toHaveBeenCalled();
    unmount();
  } finally {
    HTMLElement.prototype.animate = original;
    delete document.documentElement.dataset.motion;
  }
});
