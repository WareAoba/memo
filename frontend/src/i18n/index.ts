import i18next, { type TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

export const languages = ['ko', 'en', 'ja'] as const;
export type Language = (typeof languages)[number];
export type MessageKey = keyof typeof ko;
export const languageStorageKey = 'preset.language';

export function supportedLanguage(value: string | null | undefined): Language | undefined {
  const base = value?.toLowerCase().split(/[-_]/)[0];
  return languages.find((language) => language === base);
}

export function detectLanguage(): Language {
  try {
    const saved = supportedLanguage(localStorage.getItem(languageStorageKey));
    if (saved) return saved;
  } catch {
    /* Storage is optional. */
  }
  for (const value of navigator.languages ?? [navigator.language]) {
    const language = supportedLanguage(value);
    if (language) return language;
  }
  return 'ko';
}

void i18next.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en }, ja: { translation: ja } },
  lng: detectLanguage(),
  supportedLngs: [...languages],
  fallbackLng: 'ko',
  keySeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export const tr = (key: MessageKey, options?: TOptions): string => i18next.t(key, options);
export const isMessageKey = (value: string): value is MessageKey => Object.hasOwn(ko, value);
export const displayMessage = (value: string): string => (isMessageKey(value) ? tr(value) : value);
export const currentLanguage = (): Language => supportedLanguage(i18next.resolvedLanguage) ?? 'ko';
export const locale = () => ({ ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' })[currentLanguage()];
export const monthLabel = (month: number, short = false) =>
  new Intl.DateTimeFormat(locale(), { month: short ? 'short' : 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
export const weekdays = () =>
  Array.from({ length: 7 }, (_, day) =>
    new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, day + 1)),
    ),
  );

function syncDocument() {
  const language = currentLanguage();
  document.documentElement.lang = language;
  document.title = tr('app.title');
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest) manifest.href = `/manifest.${language}.webmanifest`;
  navigator.serviceWorker?.controller?.postMessage({ type: 'set-language', language });
}
i18next.on('languageChanged', syncDocument);
syncDocument();

export async function changeLanguage(language: Language) {
  await i18next.changeLanguage(language);
  try {
    localStorage.setItem(languageStorageKey, language);
  } catch {
    /* Memory fallback. */
  }
  // The active worker may exist before this page is controlled.
  if (navigator.serviceWorker) {
    void navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage({ type: 'set-language', language }))
      .catch(() => undefined);
  }
}

export default i18next;
