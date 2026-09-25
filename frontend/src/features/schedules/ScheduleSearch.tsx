import { ScheduleCardActions } from '../shared/ScheduleCardActions';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input } from '../shared/ui';
import { useEffect, useRef, useState } from 'react';
import { searchSchedules, saveSchedule, type Schedule } from '../../api/schedules';

import type { Page } from '../../api/client';
import { PresetModal } from '../shared/PresetModal';
import { ErrorBox } from '../shared/ErrorBox';
import { IconButton } from '../shared/IconButton';
import { message } from '../shared/form';
import { statusLabel } from '../workspace/progress';
import './search.css';

export function ScheduleSearch({ onClose }: { onClose: () => void }) {
  useTranslation();
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page<Schedule>>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchSchedules(query, offset, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setPage(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(message(e));
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, offset, attempt]);
  function reset() {
    setPage(undefined);
    setError('');
  }
  return (
    <PresetModal
      label={tr('ScheduleSearch.searchSchedules')}
      closeLabel={tr('ScheduleSearch.closeSearch')}
      onClose={onClose}
    >
      <div className="schedule-search">
        <label>
          {tr('ScheduleSearch.searchTerm')}
          <Input
            ref={input}
            type="search"
            maxLength={200}
            value={query}
            placeholder={tr('ScheduleSearch.workOrTaskNamesScheduleMemos')}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
              reset();
            }}
          />
        </label>
        <p className="hint">{tr('ScheduleSearch.searchesAllDates')}</p>
        {error && (
          <ErrorBox
            error={error}
            retry={() => {
              reset();
              setAttempt((n) => n + 1);
            }}
          />
        )}
        {!page && !error && <p role="status">{tr('ScheduleSearch.findingSchedules')}</p>}
        {page && (
          <>
            <p role="status">{tr('ScheduleSearch.searchResultsValue', { v1: page.total })}</p>
            {page.total === 0 && <p className="empty">{tr('ScheduleSearch.noResultsFound')}</p>}
            <ul className="schedule-search-results">
              {page.items.map((item) => (
                <li key={item.id} className="search-preview memo-preview schedule-card">
                  <a href={'#/schedules/' + item.id}>
                    <strong>{item.title || tr('Schedules.untitledSchedule')}</strong>
                    <span>
                      {item.scheduled_date} {item.start_time} —{' '}
                      {item.end_date !== item.scheduled_date ? item.end_date + ' ' : ''}
                      {item.end_time}
                    </span>
                    <span>{statusLabel(item.status)}</span>
                    {item.notes && <span className="schedule-search-notes">{item.notes}</span>}
                  </a>
                  <ScheduleCardActions
                    id={item.id}
                    label={item.title}
                    value={item.notes}
                    onSave={async (notes) => {
                      const updated = await saveSchedule({ notes }, item.id);
                      setPage(
                        (current) =>
                          current && {
                            ...current,
                            items: current.items.map((s) => (s.id === item.id ? updated : s)),
                          },
                      );
                      return updated.notes;
                    }}
                  />
                </li>
              ))}
            </ul>
            {(page.total > 20 || offset > 0) && (
              <nav
                className="schedule-search-pages"
                aria-label={tr('ScheduleSearch.searchResultPages')}
              >
                <IconButton
                  icon="left"
                  disabled={offset === 0}
                  onClick={() => {
                    setOffset(offset - 20);
                    reset();
                  }}
                >
                  {tr('ScheduleSearch.previousResults')}
                </IconButton>
                <span>
                  {page.items.length ? offset + 1 : 0}–{offset + page.items.length} / {page.total}
                </span>
                <IconButton
                  icon="right"
                  disabled={offset + page.items.length >= page.total}
                  onClick={() => {
                    setOffset(offset + 20);
                    reset();
                  }}
                >
                  {tr('ScheduleSearch.nextResults')}
                </IconButton>
              </nav>
            )}
          </>
        )}
      </div>
    </PresetModal>
  );
}
