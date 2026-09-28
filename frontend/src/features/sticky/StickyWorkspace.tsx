import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ErrorBox } from '../shared/ErrorBox';
import { readStickies, type Sticky } from './stickyState';
import { stickyDismiss } from './stickyMotion';
import { StickyWindow } from './StickyWindow';
import { StickyTray } from './StickyTray';
import './sticky.css';

export function StickyWorkspace({
  accountId,
  trackId,
  defaultTrack = false,
  main,
  hidden,
  today,
}: {
  accountId: string;
  trackId?: string;
  defaultTrack?: boolean;
  main: RefObject<HTMLElement | null>;
  hidden: boolean;
  today: string;
}) {
  useTranslation();
  const legacyKey = 'preset.stickies.' + accountId;
  const key = legacyKey + (trackId ? '.' + trackId : '');
  const [initial] = useState(() => {
    try {
      if (trackId && defaultTrack && localStorage.getItem(key) === null) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy !== null) localStorage.setItem(key, legacy);
      }
      return { notes: readStickies(key), error: false };
    } catch {
      return { notes: [] as Sticky[], error: true };
    }
  });
  const [notes, setNotes] = useState(initial.notes);
  const [storageError, setStorageError] = useState(initial.error);
  const [bounds, setBounds] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [front, setFront] = useState('');
  const [active, setActive] = useState('');
  const [restored, setRestored] = useState('');
  useEffect(() => {
    const outside = (event: Event) => {
      if (event.target instanceof Element && !event.target.closest('.sticky-window')) setActive('');
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, []);
  useLayoutEffect(() => {
    const element = main.current;
    if (!element || hidden) return;
    const measure = () => {
      const r = element.getBoundingClientRect();
      const left = Math.max(0, r.left),
        top = Math.max(0, r.top);
      setBounds({
        left,
        top,
        width: Math.max(0, Math.min(r.right, window.innerWidth) - left),
        height: Math.max(0, Math.min(r.bottom, window.innerHeight) - top),
      });
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [main, hidden]);
  useEffect(() => {
    if (notes === initial.notes) return;
    let failed = false;
    try {
      localStorage.setItem(key, JSON.stringify(notes));
    } catch {
      failed = true;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) setStorageError(failed);
    });
    return () => {
      active = false;
    };
  }, [notes, key, initial.notes]);
  function add(kind: Sticky['kind'], target = '', title = '') {
    setRestored('');
    const id = kind === 'note' ? crypto.randomUUID() : kind + ':' + target;
    setNotes((old) => {
      const existing =
        kind === 'note' ? undefined : old.find((n) => n.kind === kind && n.target === target);
      if (existing) {
        return old.map((n) => (n.id === existing.id ? { ...n, state: 'open' } : n));
      }
      return [
        ...old,
        {
          id,
          kind,
          target,
          title,
          text: '',
          x: 24 + (old.length % 6) * 24,
          y: 24 + (old.length % 6) * 24,
          width: 340,
          height: 360,
          state: 'open',
        },
      ];
    });
    setFront(id);
    setActive(id);
  }
  useEffect(() => {
    const open = () => add('note');
    const schedule = (event: Event) => {
      const { id, title } = (event as CustomEvent<{ id: string; title: string }>).detail;
      add('schedule', id, title);
    };
    const reset = () => setNotes((old) => old.filter((n) => n.kind === 'note'));
    window.addEventListener('sticky-manager', open);
    window.addEventListener('sticky-schedule', schedule);
    window.addEventListener('data-reset', reset);
    return () => {
      window.removeEventListener('sticky-manager', open);
      window.removeEventListener('sticky-schedule', schedule);
      window.removeEventListener('data-reset', reset);
    };
  }, [today]);
  function update(value: Sticky) {
    if (value.state === 'closed') {
      remove(value.id);
      return;
    }
    setNotes((old) => old.map((n) => (n.id === value.id ? value : n)));
    if (value.state !== 'open') setActive((old) => (old === value.id ? '' : old));
  }
  function remove(id: string) {
    const element = document.getElementById('sticky-' + id);
    if (element) stickyDismiss(element);
    setNotes((old) => old.filter((note) => note.id !== id));
    setRestored((old) => (old === id ? '' : old));
    setActive((old) => (old === id ? '' : old));
  }
  function restore(note: Sticky) {
    setRestored(note.state === 'minimized' ? note.id : '');
    update({ ...note, state: 'open' });
    setFront(note.id);
    setActive(note.id);
    requestAnimationFrame(() => document.getElementById('sticky-' + note.id)?.focus());
  }
  return (
    <>
      {!hidden && (
        <div className="sticky-layer" style={bounds}>
          {storageError && (
            <div className="sticky-storage-error">
              <ErrorBox error={tr('Sticky.storageError')} />
            </div>
          )}
          {notes
            .filter((n) => n.state === 'open')
            .map((note) => (
              <div
                key={note.id}
                style={{ position: 'relative', zIndex: front === note.id ? 2 : 1 }}
              >
                <StickyWindow
                  note={note}
                  bounds={bounds}
                  update={update}
                  active={active === note.id}
                  fromTray={restored === note.id}
                  focus={() => {
                    setFront(note.id);
                    setActive(note.id);
                  }}
                />
              </div>
            ))}
          <StickyTray
            notes={notes.filter((note) => note.state === 'minimized')}
            bounds={bounds}
            restore={restore}
            add={() => add('note')}
          />
        </div>
      )}
    </>
  );
}
