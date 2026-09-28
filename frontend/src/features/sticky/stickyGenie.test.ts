import { afterEach, expect, it, vi } from 'vitest';
import { stickyGenie } from './stickyGenie';
import { stickyAppear, stickyDismiss } from './stickyMotion';

afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.motion;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup() {
  const host = document.createElement('div');
  host.className = 'sticky-layer';
  host.innerHTML =
    '<section id="note" tabindex="-1"><textarea></textarea></section><button class="sticky-tray-trigger"></button>';
  document.body.append(host);
  const note = host.querySelector('section')!;
  note.querySelector('textarea')!.value = 'Keep my draft';
  vi.spyOn(note, 'getBoundingClientRect').mockReturnValue({
    left: 20,
    top: 20,
    width: 320,
    height: 280,
  } as DOMRect);
  let finish!: () => void;
  const animation = {
    finished: new Promise<void>((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  };
  const animate = vi.fn(() => animation);
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  return { host, note, finish, animate };
}

it('keeps snapshots inaccessible and restores the live window after opening finishes', async () => {
  const { host, note, finish } = setup();
  const cleanup = stickyGenie(note, true);
  expect(note.style.visibility).toBe('hidden');
  expect(host.querySelector('.sticky-genie')).toHaveAttribute('aria-hidden', 'true');
  expect(host.querySelector('.sticky-genie [id]')).toBeNull();
  expect(host.querySelector('.sticky-genie textarea')).toHaveValue('Keep my draft');
  finish();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(host.querySelector('.sticky-genie')).toBeNull();
  expect(note.style.visibility).toBe('');
  cleanup();
});

it.each(['none', 'reduced'])('skips the effect for %s motion', (motion) => {
  const { note, animate } = setup();
  document.documentElement.dataset.motion = motion;
  stickyGenie(note, false);
  expect(animate).not.toHaveBeenCalled();
});

it('can cancel an opening without leaving the live note hidden', () => {
  const { host, note } = setup();
  stickyGenie(note, true)();
  expect(note.style.visibility).toBe('');
  expect(host.querySelector('.sticky-genie')).toBeNull();
});

it('animates deletion using a disposable snapshot after the live note is removed', async () => {
  const { host, note, finish, animate } = setup();
  stickyDismiss(note);
  note.remove();
  const snapshot = host.querySelector('.sticky-dismiss')!;
  expect(snapshot).toHaveAttribute('aria-hidden', 'true');
  expect(snapshot.querySelector('[id]')).toBeNull();
  expect(snapshot.querySelector('textarea')).toHaveValue('Keep my draft');
  expect(animate).toHaveBeenCalledTimes(1);
  finish();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  expect(host.querySelector('.sticky-dismiss')).toBeNull();
});

it.each(['none', 'reduced'])('skips creation and deletion motion for %s', (motion) => {
  const { host, note, animate } = setup();
  document.documentElement.dataset.motion = motion;
  stickyAppear(note);
  stickyDismiss(note);
  expect(animate).not.toHaveBeenCalled();
  expect(host.querySelector('.sticky-dismiss')).toBeNull();
});
