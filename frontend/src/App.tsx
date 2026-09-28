import { Settings } from './features/settings/Settings';
import { StickyWorkspace } from './features/sticky/StickyWorkspace';
import { AccountBoundary } from './features/auth/AccountBoundary';
import type { Account } from './api/auth';
import { SettingsProvider } from './features/settings/SettingsProvider';
import { useSettings } from './features/settings/settingsContext';
import { useTranslation } from 'react-i18next';
import { tr } from './i18n';
import { Reminders } from './features/schedules/Reminders';
import { ActionIcon } from './features/shared/ActionIcon';
import { Button, ButtonLink, Surface } from './features/shared/ui';
import { PresetModal } from './features/shared/PresetModal';
import { Sidebar } from './features/workspace/Sidebar';
import { Today } from './features/workspace/Today';
import { ScheduleModal } from './features/schedules/Schedules';
import { ErrorBox } from './features/shared/ErrorBox';
import { TaskPresetDetail, TaskPresetEditor } from './features/tasks/TaskPresets';
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { parseWorkspaceRoute, workspaceRouteReducer } from './features/workspace/workspaceRoute';
import { emptyFields } from './api/works';
import { WorkDetail, WorkEditor } from './features/works/Works';
import { PresetWorkspace } from './features/workspace/PresetWorkspace';
import {
  Calendar,
  type CalendarMode,
  type CalendarNavigation,
} from './features/workspace/Calendar';
import { useToday } from './features/workspace/useToday';
import { TrackBoundary } from './features/workspace/TrackBoundary';
import { useTracks, type TrackControls } from './features/workspace/trackContext';
import { trackFromHash } from './features/workspace/workspaceRoute';
import { TrackSelector } from './features/workspace/TrackSelector';

export default function App() {
  return (
    <AccountBoundary>
      {(account) => (
        <SettingsProvider key={account.id}>
          <Reminders accountId={account.id}>
            {(notificationMenu) => (
              <TrackBoundary accountId={account.id}>
                <TrackWorkspace account={account} notificationMenu={notificationMenu} />
              </TrackBoundary>
            )}
          </Reminders>
        </SettingsProvider>
      )}
    </AccountBoundary>
  );
}
function TrackWorkspace({
  account,
  notificationMenu,
}: {
  account: Account;
  notificationMenu: ReactNode;
}) {
  const tracks = useTracks();
  return (
    <Workspace
      key={tracks.track.id}
      account={account}
      tracks={tracks}
      notificationMenu={notificationMenu}
    />
  );
}
function Workspace({
  account,
  tracks,
  notificationMenu,
}: {
  account: Account;
  tracks: TrackControls;
  notificationMenu: ReactNode;
}) {
  useTranslation();
  const touched = useRef(false);
  useEffect(() => {
    const beforeSwitch = (event: Event) => {
      if (touched.current && !window.confirm(tr('Tracks.discard'))) event.preventDefault();
    };
    window.addEventListener('track-before-switch', beforeSwitch);
    return () => window.removeEventListener('track-before-switch', beforeSwitch);
  }, []);
  const [navigation, dispatch] = useReducer(
    workspaceRouteReducer,
    window.location.hash,
    parseWorkspaceRoute,
  );
  const { page: path, overlay } = navigation;
  const settingsOpen = overlay?.kind === 'settings';
  const editor = overlay?.kind === 'edit' ? overlay.target : null;
  const scheduleDraft = overlay?.kind === 'schedule' ? overlay : null;
  const presetDraft = overlay?.kind === 'preset' ? overlay.preset : null;
  function closeOverlay() {
    dispatch({ type: 'close' });
    if (parseWorkspaceRoute(window.location.hash).overlay)
      window.history.replaceState(null, '', '#' + path);
  }
  const settings = useSettings();
  const [dataRevision, setDataRevision] = useState(0);
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [path, dataRevision]);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [presetRevision, setPresetRevision] = useState(0);
  const closePreset = closeOverlay;
  const closeSchedule = closeOverlay;
  function closeEditor() {
    closeOverlay();
    setScheduleRevision((v) => v + 1);
    setPresetRevision((v) => v + 1);
  }
  function savedPreset() {
    closeOverlay();
    setPresetRevision((v) => v + 1);
  }

  const [menuExpanded, setMenuExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const calendarNavigation = useRef<CalendarNavigation>(null);
  const [calendarDate, setCalendarDate] = useState<string>();
  const [online, setOnline] = useState(navigator.onLine);
  const timeZone = settings.loaded ? settings.values.time_zone : undefined;
  const today = useToday(timeZone);
  useEffect(() => {
    const change = () => {
      const track = trackFromHash(window.location.hash);
      if (!track || track === tracks.track.id)
        dispatch({ type: 'navigate', hash: window.location.hash });
    };
    const status = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', change);
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    const reset = () => {
      dispatch({ type: 'reset' });
      setDataRevision((v) => v + 1);
      setScheduleRevision((v) => v + 1);
      setPresetRevision((v) => v + 1);
      window.history.replaceState(null, '', '#/today');
    };
    window.addEventListener('data-reset', reset);
    return () => {
      window.removeEventListener('data-reset', reset);
      window.removeEventListener('hashchange', change);
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, [tracks.track.id]);
  return (
    <div
      onChangeCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          !target.closest('#track-form') &&
          !(target instanceof HTMLInputElement && target.type === 'search')
        )
          touched.current = true;
      }}
      onClickCapture={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const link = (event.target as Element).closest('a');
        if (!link || link.target === '_blank' || link.getAttribute('aria-disabled') === 'true')
          return;
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#/')) return;
        const nextTrack = trackFromHash(href);
        if (nextTrack && nextTrack !== tracks.track.id) {
          event.preventDefault();
          void tracks.select(nextTrack, href);
          return;
        }
        event.preventDefault();
        if (!parseWorkspaceRoute(href).overlay && window.location.hash !== href)
          window.history.pushState(null, '', href);
        dispatch({ type: 'navigate', hash: href });
      }}
      className={`app-shell ${settingsOpen ? 'settings-open' : ''} ${menuExpanded ? 'menu-expanded' : ''} ${path === '/calendar' ? 'calendar-shell' : path === '/today' ? 'today-shell' : ''}`}
    >
      <header className="site-header">
        <div className="header-brand-group">
          <div className="menu-button-slot">
            <Button
              iconOnly
              variant="ghost"
              id="menu-expand"
              className="menu-expand-button"
              aria-label={menuExpanded ? tr('App.collapseMenu') : tr('App.expandMenu')}
              aria-expanded={menuExpanded}
              aria-controls="workspace-navigation"
              onClick={() => setMenuExpanded((expanded) => !expanded)}
            >
              <ActionIcon name="menu" />
            </Button>
          </div>
          <a className="brand" href="#/today">
            <span aria-hidden="true" className="brand-mark">
              P
            </span>
            Preset
          </a>
          <TrackSelector {...tracks} />
        </div>
        {!settingsOpen && (
          <ButtonLink
            variant="primary"
            className="header-add-schedule"
            data-modal-trigger
            href={
              '#/schedules/new?date=' +
              (!settingsOpen && path === '/calendar' && calendarMode === 'day'
                ? (calendarDate ?? today)
                : today)
            }
          >
            <ActionIcon name="plus" />
            {tr('App.addSchedule')}
          </ButtonLink>
        )}
        <div className="header-notifications">{notificationMenu}</div>
      </header>
      <Sidebar
        account={account}
        settingsOpen={settingsOpen}
        onSettings={() => {
          dispatch({ type: 'settings' });
          setMenuExpanded(false);
        }}
        expanded={menuExpanded}
        onExpanded={setMenuExpanded}
        path={path}
        today={today}
        calendarMode={calendarMode}
        onCalendarMode={(mode) => {
          if (calendarNavigation.current && !settingsOpen)
            calendarNavigation.current.changeMode(mode);
          else setCalendarMode(mode);
        }}
      />
      <main ref={main} hidden={settingsOpen}>
        {!online && (
          <Surface as="div" tone="danger" className="error-box" role="status">
            {tr('App.youAreOfflineReconnectAndTrySavingAgain')}
          </Surface>
        )}
        {settings.error && <ErrorBox error={settings.error} retry={settings.retry} />}
        <div
          key={`${path.startsWith('/presets/') ? '/presets' : path}:${dataRevision}`}
          className="route-content"
        >
          {path === '/today' ? (
            <Today revision={scheduleRevision} today={today} timeZone={timeZone} />
          ) : path === '/calendar' ? (
            timeZone ? (
              <Calendar
                navigationRef={calendarNavigation}
                revision={scheduleRevision}
                today={today}
                mode={calendarMode}
                onModeChange={setCalendarMode}
                onSelectedDateChange={setCalendarDate}
              />
            ) : (
              <p role="status">{tr('App.loadingAppSettings')}</p>
            )
          ) : path === '/presets/tasks' || path === '/presets/works' ? (
            <PresetWorkspace
              kind={path === '/presets/tasks' ? 'tasks' : 'works'}
              revision={presetRevision}
            />
          ) : (
            <ErrorBox error={tr('App.pageNotFound')} />
          )}
        </div>
      </main>
      <StickyWorkspace
        accountId={account.id}
        trackId={tracks.track.id}
        defaultTrack={tracks.track.id === tracks.tracks.default_id}
        main={main}
        hidden={settingsOpen}
        today={today}
      />
      {settingsOpen && (
        <main className="settings-main">
          <Settings
            trackName={tracks.track.name}
            onClose={() => {
              dispatch({ type: 'close' });
              requestAnimationFrame(() => document.getElementById('account-menu-trigger')?.focus());
            }}
          />
        </main>
      )}
      {editor?.kind === 'schedules' && (
        <ScheduleModal key={editor.id} id={editor.id} onClose={closeEditor} onSaved={closeEditor} />
      )}
      {editor && editor.kind !== 'schedules' && (
        <PresetModal
          key={editor.kind + editor.id}
          label={
            editor.kind === 'works' ? tr('WorkDetail.editWork') : tr('TaskPresetDetail.editTask')
          }
          onClose={closeEditor}
        >
          {editor.kind === 'works' ? (
            <WorkDetail id={editor.id} edit modal />
          ) : (
            <TaskPresetDetail id={editor.id} edit modal />
          )}
        </PresetModal>
      )}
      {presetDraft && (
        <PresetModal
          label={presetDraft === 'works' ? tr('App.createWork') : tr('App.createTask')}
          closeLabel={tr('App.closeCreationForm')}
          onClose={closePreset}
        >
          {presetDraft === 'works' ? (
            <WorkEditor
              embedded
              initial={emptyFields}
              onDone={savedPreset}
              onCancel={closePreset}
            />
          ) : (
            <TaskPresetEditor embedded onDone={savedPreset} onCancel={closePreset} />
          )}
        </PresetModal>
      )}
      {scheduleDraft && (
        <ScheduleModal
          initialDate={scheduleDraft.date}
          timeZone={timeZone}
          onClose={closeSchedule}
          onSaved={() => {
            closeSchedule();
            setScheduleRevision((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
