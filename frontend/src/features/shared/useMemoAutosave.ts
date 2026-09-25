import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { message } from './form';

type Save = (text: string) => Promise<string | void>;
export const MEMO_DEBOUNCE_MS = 600;

/** Serializes writes so late responses never replace newer typing. */
export class MemoAutosave {
  private saved: string;
  private source: string;
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: Promise<boolean>;
  private drain = false;
  private changedAt = 0;
  private listeners = new Set<() => void>();
  private state: { text: string; dirty: boolean; saving: boolean; error: string; saved: boolean };
  constructor(
    value: string,
    public save: Save,
    public disabled = false,
  ) {
    this.saved = this.source = value;
    this.state = { text: value, dirty: false, saving: false, error: '', saved: false };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  sync(value: string, save: Save, disabled: boolean) {
    this.save = save;
    const wasDisabled = this.disabled;
    this.disabled = disabled;
    if (value !== this.source) {
      this.source = value;
      if (!this.state.dirty && !this.flight) {
        this.saved = value;
        this.publish({ text: value });
      }
    }
    if (wasDisabled && !disabled && this.state.dirty && !this.state.error) this.schedule();
  }
  change = (text: string) => {
    this.changedAt = Date.now();
    this.publish({ text, dirty: text !== this.saved, error: '', saved: false });
    this.schedule();
  };
  private schedule() {
    clearTimeout(this.timer);
    if (this.state.dirty)
      this.timer = setTimeout(() => {
        void this.flush(false);
      }, MEMO_DEBOUNCE_MS);
  }
  flush = (drain = true): Promise<boolean> => {
    clearTimeout(this.timer);
    if (this.flight) {
      this.drain ||= drain;
      return this.flight;
    }
    if (!this.state.dirty) return Promise.resolve(true);
    if (this.disabled) return Promise.resolve(false);
    this.drain = drain;
    this.publish({ saving: true, error: '' });
    this.flight = (async () => {
      try {
        while (this.state.dirty) {
          const text = this.state.text;
          const result = await Promise.resolve().then(() => this.save(text));
          this.saved = result ?? text;
          const latest = this.state.text === text ? this.saved : this.state.text;
          this.publish({
            text: latest,
            dirty: latest !== this.saved,
            saved: latest === this.saved,
          });
          if (!this.drain && this.state.dirty && Date.now() - this.changedAt < MEMO_DEBOUNCE_MS)
            break;
        }
        return !this.state.dirty;
      } catch (error) {
        this.publish({ error: message(error), saved: false });
        return false;
      } finally {
        this.flight = undefined;
        this.publish({ saving: false });
      }
    })();
    return this.flight;
  };
  leave = (onSaved?: () => void) => {
    // StrictMode temporarily unsubscribes and immediately subscribes again.
    queueMicrotask(() => {
      if (!this.listeners.size)
        void this.flush().then((saved) => {
          if (saved && !this.listeners.size) onSaved?.();
        });
    });
  };
}

// Failed or in-flight drafts survive closing a detail view within this app session.
const pendingEditors = new Map<string, MemoAutosave>();
function protectPendingEditors(event: BeforeUnloadEvent) {
  if (
    [...pendingEditors.values()].some(
      (writer) => writer.snapshot().dirty || writer.snapshot().saving,
    )
  ) {
    event.preventDefault();
    event.returnValue = '';
  }
}
export function useMemoAutosave(value: string, onSave: Save, disabled = false, draftKey?: string) {
  const [writer] = useState(() => {
    const existing = draftKey ? pendingEditors.get(draftKey) : undefined;
    const result = existing ?? new MemoAutosave(value, onSave, disabled);
    if (draftKey) pendingEditors.set(draftKey, result);
    return result;
  });
  const state = useSyncExternalStore(writer.subscribe, writer.snapshot, writer.snapshot);
  useLayoutEffect(() => writer.sync(value, onSave, disabled), [writer, value, onSave, disabled]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (writer.snapshot().dirty || writer.snapshot().saving) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', draftKey ? protectPendingEditors : beforeUnload);
    return () => {
      if (!draftKey) window.removeEventListener('beforeunload', beforeUnload);
      writer.leave(() => {
        if (draftKey && pendingEditors.get(draftKey) === writer) pendingEditors.delete(draftKey);
        if (!pendingEditors.size) window.removeEventListener('beforeunload', protectPendingEditors);
      });
    };
  }, [writer, draftKey]);
  return { ...state, change: writer.change, flush: writer.flush };
}
