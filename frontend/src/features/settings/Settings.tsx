import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import './settings.css';
import { SettingsFields } from './SettingsFields';
import { DataReset } from './DataReset';
import { useSettings } from './settingsContext';
import { ErrorBox } from '../shared/ErrorBox';

const tabs = ['general', 'appearance', 'scheduling', 'notifications', 'data'] as const;

export function Settings({ onClose }: { onClose: () => void }) {
  useTranslation();
  const [active, setActive] = useState<(typeof tabs)[number]>('general');
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
        navigation={
          <div
            className="settings-tabs"
            role="tablist"
            aria-label={tr('Settings.tabs')}
            aria-orientation="horizontal"
          >
            {tabs.map((tab, index) => (
              <Button
                key={tab}
                id={`settings-tab-${tab}`}
                variant="option"
                role="tab"
                aria-selected={active === tab}
                aria-controls={`settings-panel-${tab}`}
                tabIndex={active === tab ? 0 : -1}
                onClick={() => setActive(tab)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  const target = tabs[next]!;
                  setActive(target);
                  document.getElementById(`settings-tab-${target}`)?.focus();
                }}
              >
                {tr(`Settings.${tab}`)}
              </Button>
            ))}
          </div>
        }
      />
      <div className="settings-body">
        <div
          key={active}
          className="settings-panel view-enter"
          role="tabpanel"
          id={`settings-panel-${active}`}
          aria-labelledby={`settings-tab-${active}`}
          tabIndex={0}
        >
          <h2>{tr(`Settings.${active}`)}</h2>
          <p role="status">
            {!settings.loaded
              ? tr('Settings.loading')
              : settings.saving
                ? tr('Settings.saving')
                : settings.error
                  ? tr('Settings.unsaved')
                  : tr('Settings.autoSave')}
          </p>
          {settings.error && <ErrorBox error={settings.error} retry={settings.retry} />}
          {active === 'data' ? settings.loaded && <DataReset /> : <SettingsFields tab={active} />}
        </div>
      </div>
    </section>
  );
}
