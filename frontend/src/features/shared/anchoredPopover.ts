type Placement = {
  width?: number;
  minWidth?: number;
  maxHeight?: number;
  gap?: number;
  align?: 'start' | 'center';
};

/** Owns geometry and subscriptions only; callers retain focus, dismissal and motion. */
export function observeAnchoredPopover(
  menu: HTMLDivElement,
  anchor: HTMLElement,
  { width, minWidth = 0, maxHeight = Infinity, gap = 4, align = 'start' }: Placement = {},
) {
  menu.showPopover?.();
  function position() {
    const rect = anchor.getBoundingClientRect();
    const availableWidth = Math.max(0, window.innerWidth - 24);
    const menuWidth = Math.min(width ?? Math.max(rect.width, minWidth), availableWidth);
    menu.style.position = 'fixed';
    menu.style.margin = '0';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.width = `${menuWidth}px`;
    const left = align === 'center' ? rect.left + (rect.width - menuWidth) / 2 : rect.left;
    menu.style.left = `${Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12))}px`;
    const below = Math.max(0, window.innerHeight - rect.bottom - gap - 12);
    const above = Math.max(0, rect.top - gap - 12);
    const upwards = below < Math.min(menu.scrollHeight, maxHeight) && above > below;
    menu.style.maxHeight = `${Math.min(maxHeight, upwards ? above : below)}px`;
    const top = upwards ? rect.top - menu.offsetHeight - gap : rect.bottom + gap;
    menu.style.top = `${Math.max(12, Math.min(top, window.innerHeight - menu.offsetHeight - 12))}px`;
  }
  position();
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
  observer?.observe(anchor);
  observer?.observe(menu);
  function scroll(event: Event) {
    // Scrolling a wheel/list inside the popup does not move its anchor.
    if (event.target instanceof Node && menu.contains(event.target)) return;
    position();
  }
  window.addEventListener('resize', position);
  document.addEventListener('scroll', scroll, true);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', position);
    document.removeEventListener('scroll', scroll, true);
    menu.hidePopover?.();
  };
}
