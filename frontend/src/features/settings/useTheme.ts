import { useEffect } from 'react';
import type { UserSettings } from '../../api/settings';

/** Shared by the app settings and the API-free design reference. */
export function useTheme(theme: UserSettings['theme']) {
  useEffect(() => {
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (systemDark?.matches ? 'dark' : 'light') : theme;
    };
    apply();
    systemDark?.addEventListener('change', apply);
    return () => systemDark?.removeEventListener('change', apply);
  }, [theme]);
}
