import { useTranslation } from 'react-i18next';
import { useLayoutEffect, useRef, useState } from 'react';
import { tr } from '../../i18n';
import { Button } from '../shared/ui';
import { stickyDismiss } from './stickyMotion';
import { StickyWindow } from './StickyWindow';
import { StickyTray } from './StickyTray';
import type { Sticky } from './stickyState';
import './sticky.css';

/** In-memory preview: never touches an account, storage, or schedule API. */
export function StickyDemo() {
  useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState(false);
  const [fromTray, setFromTray] = useState(false);
  const [note, setNote] = useState<Sticky>({
    id: 'preview-note',
    kind: 'note',
    target: '',
    title: '',
    text: '',
    x: 16,
    y: 16,
    width: 320,
    height: 280,
    state: 'open',
  });
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <Button
        onClick={() => {
          setFromTray(note.state === 'minimized');
          setNote((old) => ({
            ...old,
            ...(old.state === 'closed'
              ? { title: '', text: '', x: 16, y: 16, width: 320, height: 280 }
              : {}),
            state: 'open',
          }));
          setActive(true);
        }}
      >
        {tr('Sticky.add')}
      </Button>
      <div
        ref={panel}
        style={{ position: 'relative', height: 420, overflow: 'hidden' }}
        onPointerDownCapture={(event) => {
          if (!(event.target as Element).closest('.sticky-window')) setActive(false);
        }}
      >
        {note.state === 'open' && (
          <StickyWindow
            note={note}
            bounds={{ width, height: 420 }}
            update={(value) => {
              if (value.state === 'closed') {
                const element = document.getElementById('sticky-' + value.id);
                if (element) stickyDismiss(element);
                setFromTray(false);
                setNote({ ...value, text: '', title: '' });
              } else setNote(value);
            }}
            active={active}
            fromTray={fromTray}
            focus={() => setActive(true)}
          />
        )}
        <StickyTray
          notes={note.state === 'minimized' ? [note] : []}
          bounds={{ width, height: 420 }}
          add={() => {
            setFromTray(false);
            setNote((old) => ({ ...old, state: 'open' }));
            setActive(true);
          }}
          restore={() => {
            setFromTray(true);
            setNote((old) => ({ ...old, state: 'open' }));
            setActive(true);
          }}
        />
      </div>
    </>
  );
}
