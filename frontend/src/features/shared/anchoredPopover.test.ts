import { afterEach, expect, it, vi } from 'vitest';
import { observeAnchoredPopover } from './anchoredPopover';

afterEach(() => vi.restoreAllMocks());

it('ignores popup wheel scrolling but follows scrolling outside the popup', () => {
  const anchor = document.createElement('button');
  const menu = document.createElement('div');
  const wheel = document.createElement('div');
  menu.append(wheel);
  document.body.append(menu);
  const measure = vi.spyOn(anchor, 'getBoundingClientRect');
  const stop = observeAnchoredPopover(menu, anchor, { width: 280 });
  measure.mockClear();
  wheel.dispatchEvent(new Event('scroll', { bubbles: false }));
  menu.dispatchEvent(new Event('scroll', { bubbles: false }));
  expect(measure).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('scroll'));
  expect(measure).toHaveBeenCalledOnce();
  stop();
  menu.remove();
});

it('fits wide menus horizontally, flips above, follows scroll and releases listeners', () => {
  const anchor = document.createElement('button');
  const menu = document.createElement('div');
  let top = window.innerHeight - 50;
  vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({
    left: window.innerWidth - 90,
    right: window.innerWidth - 10,
    top,
    bottom: top + 44,
    width: 80,
    height: 44,
    x: 0,
    y: top,
    toJSON() {},
  }));
  Object.defineProperty(menu, 'scrollHeight', { value: 400 });
  Object.defineProperty(menu, 'offsetHeight', {
    get: () => Math.min(400, parseFloat(menu.style.maxHeight)),
  });
  const stop = observeAnchoredPopover(menu, anchor, { minWidth: 260, maxHeight: 280 });
  expect(parseFloat(menu.style.left) + parseFloat(menu.style.width)).toBeLessThanOrEqual(
    window.innerWidth - 12,
  );
  expect(parseFloat(menu.style.top)).toBeLessThan(top);
  expect(menu.style.maxHeight).toBe('280px');
  top = 30;
  document.dispatchEvent(new Event('scroll'));
  expect(menu.style.top).toBe('78px');
  stop();
  top = 100;
  window.dispatchEvent(new Event('resize'));
  expect(menu.style.top).toBe('78px');
});

it('constrains an oversized centered popup to the available viewport', () => {
  const anchor = document.createElement('button');
  const menu = document.createElement('div');
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 44,
    top: 0,
    bottom: 44,
    width: 44,
    height: 44,
    x: 0,
    y: 0,
    toJSON() {},
  });
  Object.defineProperty(menu, 'scrollHeight', { value: 2000 });
  const stop = observeAnchoredPopover(menu, anchor, { width: 2000, align: 'center', gap: 8 });
  expect(menu.style.left).toBe('12px');
  expect(parseFloat(menu.style.width)).toBe(window.innerWidth - 24);
  expect(parseFloat(menu.style.maxHeight)).toBe(window.innerHeight - 64);
  stop();
});
