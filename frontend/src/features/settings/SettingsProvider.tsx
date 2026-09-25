import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  bootstrapSettings,
  loadSettings,
  patchSettings,
  defaultSettings,
  type UserSettings,
} from '../../api/settings';
import { changeLanguage, currentLanguage } from '../../i18n';
import { message } from '../shared/form';
import { SettingsContext } from './settingsContext';
import './preferences.css';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<UserSettings>(() => ({
    ...defaultSettings,
    language: currentLanguage(),
  }));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<Partial<UserSettings>>({});
  const running = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const ready = useRef(false);
  const failed = useRef(false);
  const refresh = useCallback(async () => {
    if (running.current || Object.keys(pending.current).length) return;
    const version = ++generation.current;
    try {
      const next = await (ready.current ? loadSettings() : bootstrapSettings());
      if (!alive.current || version !== generation.current) return;
      ready.current = true;
      setValues(next);
      setLoaded(true);
      setError('');
    } catch (e) {
      if (alive.current && version === generation.current) setError(message(e));
    }
  }, []);
  const flush = useCallback(async () => {
    if (running.current || !ready.current) return;
    running.current = true;
    failed.current = false;
    setSaving(true);
    setError('');
    ++generation.current;
    try {
      while (Object.keys(pending.current).length) {
        const batch = pending.current;
        pending.current = {};
        try {
          const saved = await patchSettings(batch);
          if (alive.current) setValues({ ...saved, ...pending.current });
        } catch (e) {
          pending.current = { ...batch, ...pending.current };
          failed.current = true;
          if (alive.current) setError(message(e));
          break;
        }
      }
    } finally {
      running.current = false;
      if (alive.current) setSaving(false);
    }
  }, []);
  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      if (!ready.current) return;
      ++generation.current;
      pending.current = { ...pending.current, ...patch };
      setValues((previous) => ({ ...previous, ...patch }));
      void flush();
    },
    [flush],
  );
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void refresh();
    });
    const reload = () => {
      if (document.visibilityState !== 'hidden') void refresh();
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (running.current || Object.keys(pending.current).length) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    document.addEventListener('visibilitychange', reload);
    window.addEventListener('beforeunload', warn);
    const timer = window.setInterval(reload, 30000);
    return () => {
      disposed = true;
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', reload);
      window.removeEventListener('online', reload);
      document.removeEventListener('visibilitychange', reload);
      window.removeEventListener('beforeunload', warn);
    };
  }, [refresh]);
  useEffect(() => {
    void changeLanguage(values.language);
    const root = document.documentElement;
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');
    const systemMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const apply = () => {
      root.dataset.theme =
        values.theme === 'system' ? (systemDark?.matches ? 'dark' : 'light') : values.theme;
      root.dataset.motion =
        values.motion === 'system' ? (systemMotion?.matches ? 'reduced' : 'full') : values.motion;
      root.dataset.accent = values.accent;
      root.dataset.contentWidth = values.content_width;
      root.style.setProperty('--content-scale', String(values.content_scale / 100));
    };
    apply();
    systemDark?.addEventListener('change', apply);
    systemMotion?.addEventListener('change', apply);
    return () => {
      systemDark?.removeEventListener('change', apply);
      systemMotion?.removeEventListener('change', apply);
    };
  }, [values]);
  return (
    <SettingsContext.Provider
      value={{
        values,
        loaded,
        saving,
        error,
        update,
        retry: () => {
          if (failed.current || Object.keys(pending.current).length) void flush();
          else void refresh();
        },
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
