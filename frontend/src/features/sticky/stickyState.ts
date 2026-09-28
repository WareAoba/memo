export type Sticky = {
  id: string;
  kind: 'note' | 'date' | 'schedule';
  target: string;
  text: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'open' | 'minimized' | 'closed';
};

export function fitSticky(note: Sticky, width: number, height: number): Sticky {
  const w = Math.min(Math.max(260, note.width), 640, width);
  const h = Math.min(Math.max(180, note.height), 720, height);
  return {
    ...note,
    width: w,
    height: h,
    x: Math.max(0, Math.min(note.x, width - w)),
    y: Math.max(0, Math.min(note.y, height - h)),
  };
}

/** Bottom-right resize keeps the top and left edges anchored. */
export function resizeSticky(
  note: Sticky,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): Sticky {
  const width = Math.min(
    bounds.width - note.x,
    640,
    Math.max(Math.min(260, bounds.width), note.width + dx),
  );
  const height = Math.min(
    bounds.height - note.y,
    720,
    Math.max(Math.min(180, bounds.height), note.height + dy),
  );
  return { ...note, width, height };
}

export function readStickies(key: string): Sticky[] {
  const raw: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(raw)) throw new Error('Invalid sticky data');
  return raw.filter(
    (n): n is Sticky =>
      n &&
      typeof n === 'object' &&
      ['id', 'target', 'text', 'title'].every((k) => typeof n[k] === 'string') &&
      ['x', 'y', 'width', 'height'].every(
        (k) => typeof n[k] === 'number' && Number.isFinite(n[k]),
      ) &&
      ['note', 'date', 'schedule'].includes(n.kind) &&
      ['open', 'minimized', 'closed'].includes(n.state),
  );
}

export function openScheduleSticky(id: string, title: string) {
  window.dispatchEvent(new CustomEvent('sticky-schedule', { detail: { id, title } }));
}
