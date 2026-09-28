import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { VerticalTabs } from '../shared/VerticalTabs';
import { IconButton } from '../shared/IconButton';
import './settings.css';
import { SettingsFields } from './SettingsFields';
import { DataReset } from './DataReset';
import { useSettings } from './settingsContext';
import { ErrorBox } from '../shared/ErrorBox';

const tabs = ['general', 'appearance', 'scheduling', 'notifications', 'data'] as const;

export function Settings({ onClose, trackName }: { onClose: () => void; trackName?: string }) {
  useTranslation();
  const settings = useSettings();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="settings-workspace view-enter" aria-labelledby="settings-title">
      <WorkspaceHeader
        title={
          <h1 id="settings-title" ref={heading} tabIndex={-1}>
            {tr('Settings.title')}
          </h1>
        }
        actions={<IconButton icon="close" aria-label={tr('Settings.close')} onClick={onClose} />}
      />
      <VerticalTabs
        label={tr('Settings.tabs')}
        items={tabs.map((value) => ({ value, label: tr(`Settings.${value}`) }))}
      >
        {(active) => (
          <div className="settings-panel">
            <h2>{tr(`Settings.${active}`)}</h2>
            {!settings.loaded && <p role="status">{tr('Settings.loading')}</p>}
            {settings.error && <ErrorBox error={settings.error} retry={settings.retry} />}
            {active === 'data' ? (
              settings.loaded && <DataReset trackName={trackName} />
            ) : (
              <SettingsFields tab={active} />
            )}
          </div>
        )}
      </VerticalTabs>
    </section>
  );
}
