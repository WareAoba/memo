import { requestJson, record } from './client';
import { LocalizedError } from '../i18n/errors';
import { currentLanguage, type Language } from '../i18n';

export type UserSettings = {
  language: Language;
  time_zone: string;
  theme: 'light' | 'dark' | 'system';
  content_scale: number;
  content_width: 'compact' | 'standard' | 'full';
  clock_step: number;
  accent: 'violet' | 'blue' | 'green' | 'rose' | 'orange';
  push_enabled: boolean;
  motion: 'system' | 'full' | 'reduced' | 'none';
};
export const defaultSettings: UserSettings = {
  language: 'ko',
  time_zone: 'UTC',
  theme: 'system',
  content_scale: 100,
  content_width: 'full',
  clock_step: 5,
  accent: 'violet',
  push_enabled: true,
  motion: 'system',
};
function parse(value: unknown): UserSettings {
  if (
    !record(value) ||
    !['ko', 'en', 'ja'].includes(String(value.language)) ||
    !['light', 'dark', 'system'].includes(String(value.theme)) ||
    ![80, 90, 100, 110, 125].includes(value.content_scale as number) ||
    !['compact', 'standard', 'full'].includes(String(value.content_width)) ||
    ![1, 5, 10, 15, 30, 60].includes(value.clock_step as number) ||
    !['violet', 'blue', 'green', 'rose', 'orange'].includes(String(value.accent)) ||
    !['system', 'full', 'reduced', 'none'].includes(String(value.motion)) ||
    typeof value.push_enabled !== 'boolean' ||
    typeof value.time_zone !== 'string'
  )
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.time_zone });
  } catch {
    throw new LocalizedError('client.couldNotReadTheServerResponse');
  }
  return value as UserSettings;
}
export const loadSettings = async () => parse(await requestJson('/api/settings'));
export const bootstrapSettings = async () =>
  parse(
    await requestJson('/api/settings/bootstrap', 'POST', {
      language: currentLanguage(),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  );
export const patchSettings = async (patch: Partial<UserSettings>) =>
  parse(await requestJson('/api/settings', 'PATCH', patch));
export type ResetTarget = 'schedules' | 'works' | 'tasks';
export async function resetData(target: ResetTarget) {
  await requestJson('/api/settings/reset', 'POST', { target, confirmation: target });
  window.dispatchEvent(new Event('schedules-changed'));
  window.dispatchEvent(new Event('data-reset'));
}
