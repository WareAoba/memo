import { Settings } from './features/settings/Settings';
import { SettingsProvider } from './features/settings/SettingsProvider';
import { useSettings } from './features/settings/settingsContext';
import { useTranslation } from 'react-i18next';
import { tr } from './i18n';
import { Reminders } from './features/schedules/Reminders';
import { ActionIcon } from './features/shared/ActionIcon';
import { Button, Surface } from './features/shared/ui';
import { PresetModal } from './features/shared/PresetModal';
import { Sidebar } from './features/workspace/Sidebar';
import { Today } from './features/workspace/Today';
import { ScheduleEditor, ScheduleView } from './features/schedules/Schedules';
import { ErrorBox } from './features/shared/ErrorBox';
import {
  TaskPresetDetail,
  TaskPresetEditor,
  TaskPresetListView,
} from './features/tasks/TaskPresets';
import { useEffect, useState } from 'react';
import { emptyFields } from './api/works';
import { WorkDetail, WorkEditor, WorkListView } from './features/works/Works';
import { Calendar, type CalendarMode } from './features/workspace/Calendar';
import { useToday } from './features/workspace/useToday';

function route() {
  const hash = window.location.hash.slice(1);
  if (hash === '/schedules' || hash === '/schedules/') return '/calendar';
  if (hash === '/presets') return '/presets/works';
  return hash.replace(/^\/entities(?=\/|$)/, '/presets/works') || '/today';
}
type EditTarget = { kind: 'schedules' | 'works' | 'tasks'; id: string };
function editTarget(path: string): EditTarget | null {
  const match = /^\/(schedules|presets\/(works|tasks))\/([^/?]+)(?:\/edit)?$/.exec(path);
  if (!match || match[3] === 'new') return null;
  return { kind: (match[2] || match[1]) as EditTarget['kind'], id: match[3]! };
}
function backgroundRoute(path: string) {
  const target = editTarget(path);
  if (target) return target.kind === 'schedules' ? '/today' : '/presets/' + target.kind;
  return path.split('?')[0] === '/schedules/new'
    ? '/calendar'
    : path.replace(/^(\/presets\/(works|tasks))\/new$/, '$1');
}
export default function App() {
  return (
    <SettingsProvider>
      <Workspace />
    </SettingsProvider>
  );
}
function Workspace() {
  useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettings();
  const [dataRevision, setDataRevision] = useState(0);
  const [path, setPath] = useState(() => backgroundRoute(route()));
  const [editor, setEditor] = useState<EditTarget | null>(() => editTarget(route()));
  function closeEditor() {
    setEditor(null);
    setScheduleRevision((v) => v + 1);
    setPresetRevision((v) => v + 1);
    if (editTarget(route())) window.history.replaceState(null, '', '#' + path);
  }
  const [scheduleDraft, setScheduleDraft] = useState<{ date?: string } | null>(() =>
    route().split('?')[0] === '/schedules/new'
      ? { date: new URLSearchParams(route().split('?')[1]).get('date') || undefined }
      : null,
  );
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [presetDraft, setPresetDraft] = useState<'works' | 'tasks' | null>(() =>
    route() === '/presets/works/new' ? 'works' : route() === '/presets/tasks/new' ? 'tasks' : null,
  );
  const [presetRevision, setPresetRevision] = useState(0);
  function closePreset() {
    setPresetDraft(null);
    if (/^\/presets\/(works|tasks)\/new$/.test(route()))
      window.history.replaceState(null, '', '#' + path);
  }
  function savedPreset() {
    closePreset();
    setPresetRevision((v) => v + 1);
  }

  function closeSchedule() {
    setScheduleDraft(null);
    if (route().split('?')[0] === '/schedules/new')
      window.history.replaceState(null, '', '#' + path);
  }

  const [menuExpanded, setMenuExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [online, setOnline] = useState(navigator.onLine);
  const timeZone = settings.loaded ? settings.values.time_zone : undefined;
  const today = useToday(timeZone);
  useEffect(() => {
    const change = () => {
      const next = route();
      const target = editTarget(next);
      setEditor(target);
      if (target) {
        setSettingsOpen(false);
        setPresetDraft(null);
        setScheduleDraft(null);
        return;
      }
      setSettingsOpen(false);
      if (next === '/presets/works/new' || next === '/presets/tasks/new') {
        setPresetDraft(next === '/presets/works/new' ? 'works' : 'tasks');
        setScheduleDraft(null);
        return;
      }
      setPresetDraft(null);
      if (next.split('?')[0] === '/schedules/new') {
        setScheduleDraft({
          date: new URLSearchParams(next.split('?')[1]).get('date') || undefined,
        });
        return;
      }
      setScheduleDraft(null);
      setPath(next);
      window.scrollTo(0, 0);
    };
    const status = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', change);
    window.addEventListener('online', status);
    window.addEventListener('offline', status);
    const reset = () => {
      setEditor(null);
      setDataRevision((v) => v + 1);
      setScheduleRevision((v) => v + 1);
      setPresetRevision((v) => v + 1);
      setPresetDraft(null);
      setScheduleDraft(null);
      setPath('/today');
      window.history.replaceState(null, '', '#/today');
    };
    window.addEventListener('data-reset', reset);
    return () => {
      window.removeEventListener('data-reset', reset);
      window.removeEventListener('hashchange', change);
      window.removeEventListener('online', status);
      window.removeEventListener('offline', status);
    };
  }, []);
  return (
    <div
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
        if (href.startsWith('#/')) setSettingsOpen(false);
        const target = editTarget(href.slice(1).replace(/^\/entities(?=\/|$)/, '/presets/works'));
        if (target) {
          event.preventDefault();
          setEditor(target);
          return;
        }
        if (href === '#/presets/works/new' || href === '#/presets/tasks/new') {
          event.preventDefault();
          setPresetDraft(href === '#/presets/works/new' ? 'works' : 'tasks');
          return;
        }
        if (href.split('?')[0] !== '#/schedules/new') return;
        event.preventDefault();
        setScheduleDraft({
          date: new URLSearchParams(href.split('?')[1]).get('date') || undefined,
        });
      }}
      className={`app-shell ${settingsOpen ? 'settings-open' : ''} ${menuExpanded ? 'menu-expanded' : ''} ${path === '/calendar' ? 'calendar-shell' : path === '/today' ? 'today-shell' : ''}`}
    >
      {timeZone && <Reminders />}
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
        </div>
      </header>
      <Sidebar
        settingsOpen={settingsOpen}
        onSettings={() => {
          setSettingsOpen(true);
          setMenuExpanded(false);
        }}
        expanded={menuExpanded}
        onExpanded={setMenuExpanded}
        path={path}
        today={today}
        calendarMode={calendarMode}
        onCalendarMode={setCalendarMode}
      />
      <main hidden={settingsOpen}>
        {!online && (
          <Surface as="div" tone="danger" className="error-box" role="status">
            {tr('App.youAreOfflineReconnectAndTrySavingAgain')}
          </Surface>
        )}
        {settings.error && <ErrorBox error={settings.error} retry={settings.retry} />}
        <div key={`${path}:${dataRevision}`} className="route-content">
          {path === '/today' ? (
            <Today revision={scheduleRevision} today={today} timeZone={timeZone} />
          ) : path === '/calendar' ? (
            timeZone ? (
              <Calendar
                revision={scheduleRevision}
                today={today}
                mode={calendarMode}
                onModeChange={setCalendarMode}
              />
            ) : (
              <p role="status">{tr('App.loadingAppSettings')}</p>
            )
          ) : path === '/presets/tasks' ? (
            <TaskPresetListView revision={presetRevision} />
          ) : path === '/presets/works' ? (
            <WorkListView revision={presetRevision} />
          ) : (
            <ErrorBox error={tr('App.pageNotFound')} />
          )}
        </div>
      </main>
      {settingsOpen && (
        <main className="settings-main">
          <Settings
            onClose={() => {
              setSettingsOpen(false);
              requestAnimationFrame(() => document.getElementById('open-settings')?.focus());
            }}
          />
        </main>
      )}
      {editor && (
        <PresetModal
          key={editor.kind + editor.id}
          label={
            editor.kind === 'schedules'
              ? tr('ScheduleEditor.editSchedule')
              : editor.kind === 'works'
                ? tr('WorkDetail.editWork')
                : tr('TaskPresetDetail.editTask')
          }
          variant={editor.kind === 'schedules' ? 'schedule' : 'detail'}
          onClose={closeEditor}
        >
          {editor.kind === 'schedules' ? (
            <ScheduleView id={editor.id} edit modal onClose={closeEditor} />
          ) : editor.kind === 'works' ? (
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
        <PresetModal
          label={tr('App.addSchedule')}
          variant="schedule"
          closeLabel={tr('App.closeNewSchedule')}
          onClose={closeSchedule}
        >
          {timeZone ? (
            <ScheduleEditor
              embedded
              timeZone={timeZone}
              initialDate={scheduleDraft.date}
              onCancel={closeSchedule}
              onSaved={() => {
                closeSchedule();
                setScheduleRevision((v) => v + 1);
              }}
            />
          ) : (
            <p role="status">{tr('App.loadingAppSettings')}</p>
          )}
        </PresetModal>
      )}
    </div>
  );
}
