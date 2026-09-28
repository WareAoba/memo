import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { ButtonLink, Input, Surface, CardButton } from '../shared/ui';
import { DropdownSelect } from '../shared/DropdownSelect';
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
export function TaskPresetListView({
  revision = 0,
  heading = true,
}: {
  revision?: number;
  heading?: boolean;
}) {
  useTranslation();
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState({ q: '', offset: 0, group: '*' });
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
      false,
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
      <WorkspaceHeader
        title={heading && <h1>{tr('TaskPresetListView.taskPresets')}</h1>}
        actions={
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
        }
        navigation={heading && <PresetSwitch kind="tasks" />}
        tools={
          <section aria-label={tr('Picker.searchTasks')} className="workspace-list-tools">
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
            <DropdownSelect
              hideLabel
              label={tr('design-reference.group')}
              value={filter.group}
              onChange={(group) => update({ ...filter, group, offset: 0 })}
              options={[
                { value: '*', label: tr('TaskPresetListView.allGroups') },
                { value: 'group:', label: tr('TaskGroupPicker.ungrouped') },
                ...groups.names.map((name) => ({ value: 'group:' + name, label: name })),
              ]}
            />
          </section>
        }
      />
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
            {data.total > 0 && (
              <p className="result-count">
                {tr('TaskPresetListView.valueValueValue', {
                  v1: tr('ScheduleEditor.task'),
                  v2: data.total,
                  v3: filter.q && tr('TaskPresetListView.resultsForValue', { v1: filter.q }),
                })}
              </p>
            )}
            {data.items.length === 0 ? (
              <Surface as="section" className="empty">
                <h2>
                  {filter.q
                    ? tr('ScheduleSearch.noResultsFound')
                    : tr('TaskPresetListView.createYourFirstTask')}
                </h2>
                <p>
                  {filter.q
                    ? tr('TaskPresetListView.tryAnotherNameOrTag')
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
                            <div
                              key={item.id}
                              data-context-content
                              className="preset-preview memo-preview"
                            >
                              <CardButton
                                type="button"
                                key={item.id}
                                data-modal-trigger
                                data-context-action="edit"
                                data-context-label={tr('App.edit')}
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
