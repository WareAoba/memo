import { tr, type MessageKey } from '../../i18n';
import type { UserSettings } from '../../api/settings';
import { Input } from '../shared/ui';
import { DropdownSelect } from '../shared/DropdownSelect';
import { PushSettings } from '../schedules/PushSettings';
import { useSettings } from './settingsContext';

export type SettingsTab = 'general' | 'appearance' | 'scheduling' | 'notifications' | 'data';
export function SettingsFields({ tab }: { tab: SettingsTab }) {
  const { values, update, loaded } = useSettings();
  function choice<K extends keyof UserSettings>(
    key: K,
    label: MessageKey,
    options: readonly (readonly [UserSettings[K], string])[],
  ) {
    return (
      <DropdownSelect
        key={key}
        label={tr(label)}
        disabled={!loaded}
        value={String(values[key])}
        onChange={(next) => {
          const option = options.find(([value]) => String(value) === next);
          if (option) update({ [key]: option[0] });
        }}
        options={options.map(([value, label]) => ({ value: String(value), label }))}
      />
    );
  }
  const names = (options: readonly string[]) =>
    options.map((value) => [value, tr(`Settings.${value}` as MessageKey)] as const);
  const zones = [
    ...new Set([values.time_zone, 'UTC', ...Intl.supportedValuesOf('timeZone')]),
  ].sort();
  return (
    <fieldset disabled={!loaded} className="settings-fields">
      <legend className="sr-only">{tr(`Settings.${tab}`)}</legend>
      {tab === 'general' && (
        <>
          {choice('language', 'app.language', [
            ['ko', '한국어'],
            ['en', 'English'],
            ['ja', '日本語'],
          ])}
          {choice(
            'time_zone',
            'Settings.timeZone',
            zones.map((zone) => [zone, zone]),
          )}
          <p className="hint">{tr('Settings.timeZoneHint')}</p>
        </>
      )}
      {tab === 'appearance' && (
        <>
          {choice(
            'theme',
            'Settings.theme',
            names(['light', 'dark', 'system']) as [UserSettings['theme'], string][],
          )}
          {choice(
            'content_scale',
            'Settings.scale',
            [80, 90, 100, 110, 125].map((n) => [n, `${n}%`]),
          )}
          {choice(
            'content_width',
            'Settings.width',
            names(['compact', 'standard', 'full']) as [UserSettings['content_width'], string][],
          )}
          {choice(
            'accent',
            'Settings.accent',
            names(['violet', 'blue', 'green', 'rose', 'orange']) as [
              UserSettings['accent'],
              string,
            ][],
          )}
          {choice(
            'motion',
            'Settings.motion',
            names(['system', 'full', 'reduced', 'none']) as [UserSettings['motion'], string][],
          )}
        </>
      )}
      {tab === 'scheduling' && (
        <>
          {choice(
            'clock_step',
            'Settings.clockStep',
            [1, 5, 10, 15, 30, 60].map((n) => [n, tr('Settings.minutes', { count: n })]),
          )}
          <p className="hint">{tr('Settings.clockHint')}</p>
        </>
      )}
      {tab === 'notifications' && (
        <>
          <label className="settings-toggle">
            <Input
              type="checkbox"
              checked={values.push_enabled}
              onChange={(event) => update({ push_enabled: event.target.checked })}
            />
            {tr('Settings.pushEnabled')}
          </label>
          <p>{tr('Settings.pushHint')}</p>
          <PushSettings />
        </>
      )}
    </fieldset>
  );
}
