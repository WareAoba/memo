import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n, {
  changeLanguage,
  detectLanguage,
  languageStorageKey,
  locale,
  monthLabel,
  tr,
  weekdays,
} from '.';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import { LocalizedError } from './errors';
import { ErrorBox } from '../features/shared/ErrorBox';
import { message } from '../features/shared/form';
import { WorkEditor } from '../features/works/WorkEditor';
import { emptyFields } from '../api/works';
import { reminderUnits, reminderUnitLabel } from '../api/reminderFields';
import { types } from '../features/tasks/itemTypes';
import { ScheduleColorPicker } from '../features/schedules/ScheduleColorPicker';
import { ScheduleSearchControl } from '../features/schedules/ScheduleSearchControl';

afterEach(() => {
  localStorage.removeItem(languageStorageKey);
  vi.unstubAllGlobals();
});

it('has complete catalogs with matching interpolation variables in every language', () => {
  const variables = (s: string) => [...s.matchAll(/\{\{(.*?)\}\}/g)].map((m) => m[1]).sort();
  for (const catalog of [en, ja]) {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(ko).sort());
    for (const key of Object.keys(ko) as (keyof typeof ko)[]) {
      expect(catalog[key].trim(), key).not.toBe('');
      expect(variables(catalog[key]), key).toEqual(variables(ko[key]));
      expect(catalog[key], key).not.toMatch(/[가-힣]/);
    }
  }
});

it('uses saved language, then supported browser languages, then Korean', () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'ja-JP']);
  localStorage.removeItem(languageStorageKey);
  expect(detectLanguage()).toBe('ja');
  localStorage.setItem(languageStorageKey, 'en');
  expect(detectLanguage()).toBe('en');
  localStorage.setItem(languageStorageKey, 'xx');
  expect(detectLanguage()).toBe('ja');
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
  expect(detectLanguage()).toBe('ko');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(detectLanguage()).toBe('ko');
});

it('updates document language, title, calendar labels and constant options', async () => {
  await changeLanguage('en');
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('Preset — Works and tasks');
  expect(localStorage.getItem(languageStorageKey)).toBe('en');
  expect(locale()).toBe('en-US');
  expect(weekdays()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  expect(monthLabel(9)).toBe('September');
  expect(types.checkbox).toBe('Checkbox');
  expect(reminderUnits.days).toBe('days');
  expect(reminderUnits).not.toHaveProperty('weeks');
  expect(reminderUnitLabel('hours', 1)).toBe('hour');
  expect(reminderUnitLabel('hours', 2)).toBe('hours');
  await changeLanguage('ja');
  expect(types.checkbox).toBe('チェック');
  expect(reminderUnits.days).toBe('日');
  expect(monthLabel(9)).toBe('9月');
  expect(document.title).toBe('Preset — ワークとタスク');
});

it('switches a mounted form and an existing error without losing user input', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  const originalError = message(new LocalizedError('client.theServerRequestFailed'));
  render(
    <>
      <WorkEditor initial={emptyFields} embedded />
      <ErrorBox error={originalError} />
    </>,
  );
  const input = screen.getByRole('textbox', { name: '워크 이름 *' });
  fireEvent.change(input, { target: { value: '내 워크 / My work / 私のワーク' } });
  await act(() => changeLanguage('en'));
  expect(await screen.findByRole('textbox', { name: 'Work name *' })).toBe(input);
  expect(input).toHaveValue('내 워크 / My work / 私のワーク');
  expect(screen.getByRole('alert')).toHaveTextContent('The server request failed.');
  await act(async () => {
    await i18n.changeLanguage('ja');
  });
  expect(screen.getByRole('textbox', { name: 'ワーク名 *' })).toHaveValue(
    '내 워크 / My work / 私のワーク',
  );
  expect(screen.getByRole('alert')).toHaveTextContent('サーバーへのリクエストに失敗しました。');
});

it('keeps interpolated user names as text rather than HTML', async () => {
  await i18n.changeLanguage('en');
  const name = '<img src=x onerror=alert(1)>';
  const { container } = render(<p>{tr('Picker.selectValue', { v1: name })}</p>);
  expect(container.querySelector('img')).toBeNull();
  expect(container).toHaveTextContent(`Select ${name}`);
});

it('updates independently mounted controls and fallback errors without clearing a search draft', async () => {
  render(
    <>
      <ScheduleColorPicker value="none" onChange={() => {}} />
      <ScheduleSearchControl />
      <ErrorBox error={message(undefined)} />
    </>,
  );
  const search = screen.getByRole('searchbox');
  fireEvent.change(search, { target: { value: '내 일정 / My schedule' } });
  for (const language of ['en', 'ja', 'ko'] as const) {
    await act(() => changeLanguage(language));
    expect(screen.getByRole('group', { name: tr('ScheduleColor.label') })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: tr('ScheduleColor.none') })).toBeChecked();
    expect(screen.getByRole('searchbox', { name: tr('ScheduleSearch.searchSchedules') })).toBe(
      search,
    );
    expect(search).toHaveValue('내 일정 / My schedule');
    expect(screen.getByRole('alert')).toHaveTextContent(tr('form.requestFailedTryAgain'));
  }
});

it('translates the design reference document title on language changes', async () => {
  const title = document.querySelector('title')!;
  title.setAttribute('data-i18n', 'design-reference.title');
  try {
    for (const language of ['en', 'ja', 'ko'] as const) {
      await changeLanguage(language);
      expect(document.title).toBe(tr('design-reference.title'));
    }
  } finally {
    title.removeAttribute('data-i18n');
    await changeLanguage('ko');
  }
});
