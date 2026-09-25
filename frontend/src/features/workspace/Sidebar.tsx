import { useTranslation } from 'react-i18next';
import { tr, monthLabel } from '../../i18n';
import { Button } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { useEffect, useRef, useState } from 'react';
import type { CalendarMode } from './Calendar';

export function Sidebar({
  settingsOpen = false,
  onSettings,
  path,
  today,
  calendarMode,
  onCalendarMode,
  expanded,
  onExpanded,
}: {
  settingsOpen?: boolean;
  onSettings?: () => void;
  expanded: boolean;
  onExpanded: (value: boolean) => void;
  path: string;
  today: string;
  calendarMode: CalendarMode;
  onCalendarMode: (mode: CalendarMode) => void;
}) {
  useTranslation();
  const sidebar = useRef<HTMLElement>(null);
  const mobile = () => window.matchMedia?.('(max-width: 700px)').matches ?? false;
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: MouseEvent) => {
      // Keep modal open/close clicks out of outside-navigation handling, even
      // when React mounts or removes the dialog during this same click.
      if (
        document.querySelector('dialog[open]') ||
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof Element && node.matches('#menu-expand, dialog, [data-modal-trigger]'),
          )
      )
        return;
      if (event.target instanceof Node && !sidebar.current?.contains(event.target))
        onExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        onExpanded(false);
        if (!mobile()) requestAnimationFrame(() => document.getElementById('menu-expand')?.focus());
      }
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [expanded, onExpanded]);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 700px)');
    const reset = () => onExpanded(false);
    query?.addEventListener('change', reset);
    return () => query?.removeEventListener('change', reset);
  }, [onExpanded]);
  const [drawer, setDrawer] = useState<'calendar' | 'presets' | null>(null);
  function toggleDrawer(next: 'calendar' | 'presets') {
    onExpanded(true);
    setDrawer(expanded && drawer === next ? null : next);
  }
  return (
    <aside
      ref={sidebar}
      aria-label={tr('Sidebar.navigationMenu')}
      className={`workspace-sidebar ${expanded ? 'is-expanded' : 'is-collapsed'}`}
    >
      <nav
        id="workspace-navigation"
        className="sidebar-navigation"
        aria-label={tr('Sidebar.mainMenu')}
      >
        <a
          href="#/today"
          onClick={() => {
            if (mobile()) onExpanded(false);
          }}
          aria-label={tr('Schedules.today')}
          title={tr('Schedules.today')}
          aria-current={!settingsOpen && path === '/today' ? 'page' : undefined}
        >
          <span className="date-icon" aria-hidden="true">
            <span>{monthLabel(Number(today.slice(5, 7)), true)}</span>
            <strong>{Number(today.slice(8, 10))}</strong>
          </span>
          <span className="sidebar-label">{tr('Schedules.today')}</span>
        </a>
        <div className="sidebar-group">
          <div className="sidebar-row">
            <a
              href="#/calendar"
              aria-label={tr('Sidebar.fullCalendar')}
              title={tr('Sidebar.fullCalendar')}
              aria-current={!settingsOpen && path === '/calendar' ? 'page' : undefined}
              onClick={() => {
                if (expanded || mobile()) {
                  setDrawer('calendar');
                  if (mobile()) onExpanded(true);
                }
              }}
            >
              <ActionIcon name="calendar" className="nav-symbol" />
              <span className="sidebar-label">{tr('Sidebar.fullCalendar')}</span>
            </a>
            {expanded && (
              <Button
                iconOnly
                variant="ghost"
                className="sidebar-disclosure"
                aria-label={tr('Sidebar.calendarViewMenu')}
                aria-expanded={expanded && drawer === 'calendar'}
                aria-controls="calendar-children"
                onClick={() => toggleDrawer('calendar')}
              >
                <ActionIcon name="down" />
              </Button>
            )}
          </div>
          <div
            className={`sidebar-drawer ${expanded && drawer === 'calendar' ? 'is-open' : ''}`}
            inert={!(expanded && drawer === 'calendar')}
            aria-hidden={!(expanded && drawer === 'calendar')}
          >
            <nav
              id="calendar-children"
              className="sidebar-children"
              aria-label={tr('Sidebar.calendarViews')}
            >
              {(
                [
                  ['day', tr('Sidebar.dailyDetails')],
                  ['month', tr('Sidebar.monthlyView')],
                  ['year', tr('Sidebar.selectMonthsByYear')],
                ] as const
              ).map(([mode, label]) => (
                <a
                  key={mode}
                  href="#/calendar"
                  aria-current={
                    !settingsOpen && path === '/calendar' && calendarMode === mode
                      ? 'page'
                      : undefined
                  }
                  onClick={() => {
                    onCalendarMode(mode);
                    if (mobile()) onExpanded(false);
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="sidebar-group">
          <div className="sidebar-row">
            <a
              href="#/presets/works"
              aria-label={tr('Sidebar.presetSettings')}
              title={tr('Sidebar.presetSettings')}
              aria-current={!settingsOpen && path.startsWith('/presets/') ? 'page' : undefined}
              onClick={() => {
                if (expanded || mobile()) {
                  setDrawer('presets');
                  if (mobile()) onExpanded(true);
                }
              }}
            >
              <ActionIcon name="settings" className="nav-symbol" />
              <span className="sidebar-label">{tr('Sidebar.presetSettings')}</span>
            </a>
            {expanded && (
              <Button
                iconOnly
                variant="ghost"
                className="sidebar-disclosure"
                aria-label={tr('Sidebar.presetTypeMenu')}
                aria-expanded={expanded && drawer === 'presets'}
                aria-controls="preset-children"
                onClick={() => toggleDrawer('presets')}
              >
                <ActionIcon name="down" />
              </Button>
            )}
          </div>
          <div
            className={`sidebar-drawer ${expanded && drawer === 'presets' ? 'is-open' : ''}`}
            inert={!(expanded && drawer === 'presets')}
            aria-hidden={!(expanded && drawer === 'presets')}
          >
            <nav
              id="preset-children"
              className="sidebar-children"
              aria-label={tr('Sidebar.presetTypes')}
            >
              {(['works', 'tasks'] as const).map((kind) => (
                <a
                  key={kind}
                  href={'#/presets/' + kind}
                  onClick={() => {
                    if (mobile()) onExpanded(false);
                  }}
                  aria-current={
                    !settingsOpen && path.startsWith('/presets/' + kind) ? 'page' : undefined
                  }
                >
                  {kind === 'works' ? tr('ScheduleEditor.work') : tr('ScheduleEditor.task')}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </nav>
      {onSettings && (
        <Button
          id="open-settings"
          variant="ghost"
          className="sidebar-settings"
          aria-label={tr('Settings.title')}
          title={tr('Settings.title')}
          aria-pressed={settingsOpen}
          onClick={onSettings}
        >
          <ActionIcon name="settings" />
          <span className="sidebar-label">{tr('Settings.title')}</span>
        </Button>
      )}
    </aside>
  );
}
