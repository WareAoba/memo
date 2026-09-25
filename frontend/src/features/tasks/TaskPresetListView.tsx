import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { PageHeader, ButtonLink, Input, Select, Button, Surface, CardButton } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetMemoButton } from '../shared/PresetMemoButton';
import { IconButton } from '../shared/IconButton';
import { useNames } from '../shared/useNames';
import { PresetModal, PresetSwitch } from '../shared/PresetModal';
import { TaskPresetDetail } from './TaskPresetDetail';
import { useEffect, useState } from 'react';
import { listTaskPresets } from '../../api/taskPresets';
import type { TaskPresetList } from '../../api/taskPresets';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
export function TaskPresetListView({ revision = 0 }: { revision?: number }) {
  useTranslation();
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState({ q: '', archived: false, offset: 0, group: '*' });
  const [data, setData] = useState<TaskPresetList>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const groups = useNames('/api/task-groups', attempt + revision);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    listTaskPresets(
      filter.q,
      filter.archived,
      filter.offset,
      controller.signal,
      48,
      filter.group === '*' ? undefined : filter.group.slice(6),
    )
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [filter, attempt, revision]);
  function update(next: typeof filter) {
    setLoading(true);
    setError('');
    setFilter(next);
  }
  return (
    <>
      {selected && (
        <PresetModal
          label={tr('TaskPresetDetail.editTask')}
          onClose={() => {
            setSelected(undefined);
            setAttempt((v) => v + 1);
          }}
        >
          <TaskPresetDetail id={selected} edit={false} modal />
        </PresetModal>
      )}
      <PageHeader className="page-heading">
        <div>
          <h1>{tr('TaskPresetListView.taskPresets')}</h1>
        </div>
        <div className="preset-heading-actions">
          <PresetSwitch kind="tasks" />
          <ButtonLink
            iconOnly
            variant="primary"
            title={tr('TaskPresetListView.createTask')}
            aria-label={tr('TaskPresetListView.createTask')}
            data-modal-trigger

            href="#/presets/tasks/new"
          >
            <ActionIcon name="plus" />
          </ButtonLink>
        </div>
      </PageHeader>
      <section aria-label={tr('Picker.searchTasks')} className="toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ ...filter, q: draft, offset: 0 });
          }}
        >
          <label className="sr-only" htmlFor="search">
            {tr('Picker.searchTasks')}
          </label>
          <Input
            id="search"
            type="search"
            maxLength={200}
            placeholder={tr('TaskPresetListView.searchNamesOrTags')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <IconButton icon="search" type="submit">
            {tr('TaskPresetListView.search')}
          </IconButton>
        </form>
        <label>
          <span className="sr-only">{tr('design-reference.group')}</span>
          <Select
            value={filter.group}
            onChange={(e) => update({ ...filter, group: e.target.value, offset: 0 })}
          >
            <option value="*">{tr('TaskPresetListView.allGroups')}</option>
            <option value="group:">{tr('TaskGroupPicker.ungrouped')}</option>
            {groups.names.map((name) => (
              <option key={name} value={`group:${name}`}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        <div className="tabs">
          <Button
            aria-pressed={!filter.archived}
            onClick={() => update({ ...filter, archived: false, offset: 0 })}
          >
            {tr('TaskPresetListView.active')}
          </Button>
          <Button
            aria-pressed={filter.archived}
            onClick={() => update({ ...filter, archived: true, offset: 0 })}
          >
            {tr('TaskPresetListView.archive')}
          </Button>
        </div>
      </section>
      {groups.error && <ErrorBox error={groups.error} />}
      {loading ? (
        <p role="status">{tr('TaskGroupPicker.loadingTasks')}</p>
      ) : error ? (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setLoading(true);
            setAttempt((v) => v + 1);
          }}
        />
      ) : (
        data && (
          <>
            <p className="result-count">
              {tr('TaskPresetListView.valueValueValue', {
                v1: filter.archived
                  ? tr('TaskPresetDetail.archivedTask')
                  : tr('ScheduleEditor.task'),
                v2: data.total,
                v3: filter.q && tr('TaskPresetListView.resultsForValue', { v1: filter.q }),
              })}
            </p>
            {data.items.length === 0 ? (
              <Surface as="section" className="empty">
                <h2>
                  {filter.q
                    ? tr('ScheduleSearch.noResultsFound')
                    : filter.archived
                      ? tr('TaskPresetListView.noArchivedTasks')
                      : tr('TaskPresetListView.createYourFirstTask')}
                </h2>
                <p>
                  {filter.q
                    ? tr('TaskPresetListView.tryAnotherNameOrTag')
                    : filter.archived
                      ? tr('TaskPresetListView.youCanRestoreArchivedTasksHere')
                      : tr('TaskPresetListView.saveFrequentlyUsedActionsAsTasks')}
                </p>
              </Surface>
            ) : (
              <div className="work-list compact-presets">
                {Array.from(new Set(data.items.map((item) => item.group_name || '')))
                  .sort()
                  .map((group) => (
                    <section className="task-group" key={group}>
                      <h2>{group || tr('TaskGroupPicker.ungrouped')}</h2>
                      <div className="task-group-grid">
                        {data.items
                          .filter((item) => (item.group_name || '') === group)
                          .map((item) => (
                            <div key={item.id} className="preset-preview memo-preview">
                              <CardButton
                                type="button"
                                key={item.id}
                                data-modal-trigger
                                className="work-card"
                                onClick={() => setSelected(item.id)}
                              >
                                <h2>{item.name}</h2>
                              </CardButton>
                              <PresetMemoButton
                                kind="task"
                                id={item.id}
                                name={item.name}
                                notes={item.default_notes}
                                onSaved={(default_notes) =>
                                  setData(
                                    (current) =>
                                      current && {
                                        ...current,
                                        items: current.items.map((t) =>
                                          t.id === item.id ? { ...t, default_notes } : t,
                                        ),
                                      },
                                  )
                                }
                              />
                            </div>
                          ))}
                      </div>
                    </section>
                  ))}
              </div>
            )}
            {(data.total > 48 || filter.offset > 0) && (
              <nav className="pagination" aria-label={tr('TaskPresetListView.listPages')}>
                <IconButton
                  icon="left"
                  disabled={filter.offset === 0}
                  onClick={() => update({ ...filter, offset: Math.max(0, filter.offset - 48) })}
                >
                  {tr('Picker.previous')}
                </IconButton>
                <span>
                  {data.total === 0 ? 0 : filter.offset + 1}–
                  {Math.min(filter.offset + 48, data.total)} / {data.total}
                </span>
                <IconButton
                  icon="right"
                  disabled={filter.offset + 48 >= data.total}
                  onClick={() => update({ ...filter, offset: filter.offset + 48 })}
                >
                  {tr('Picker.next')}
                </IconButton>
              </nav>
            )}
          </>
        )
      )}
    </>
  );
}
