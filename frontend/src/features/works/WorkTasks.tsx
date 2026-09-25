import { useTranslation } from 'react-i18next';
import { tr, displayMessage } from '../../i18n';
import { Surface, Button, Input } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetMemoButton } from '../shared/PresetMemoButton';
import { useEffect, useState } from 'react';
import { getWorkTasks, saveWorkTasks, type WorkTask } from '../../api/workTasks';
import { listTaskPresets, type TaskPresetList } from '../../api/taskPresets';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
export function WorkTasks({ id }: { id: string }) {
  useTranslation();
  const [items, setItems] = useState<WorkTask[]>();
  const [saved, setSaved] = useState<WorkTask[]>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<TaskPresetList>();
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getWorkTasks(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setItems(value);
          setSaved(value);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      listTaskPresets(q, false, offset, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setPage(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setSearchError(message(e));
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, offset, searchAttempt]);
  function change(next: WorkTask[]) {
    setItems(next);
    setStatus('');
  }
  function move(index: number, delta: number) {
    if (!items) return;
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    change(next);
  }
  async function save() {
    if (!items) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const value = await saveWorkTasks(
        id,
        items.map((item) => item.id),
      );
      setItems(value);
      setSaved(value);
      setStatus('WorkTasks.defaultTasksSaved');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const dirty = items?.map((item) => item.id).join(',') !== saved?.map((item) => item.id).join(',');
  return (
    <Surface as="section" className="detail-section">
      <h2>{tr('WorkTasks.defaultTasksForThisWork')}</h2>
      <p>{tr('WorkTasks.theseTasksAreSelectedByDefaultWhenCreatingA')}</p>
      {error && (
        <ErrorBox
          error={error}
          retry={
            items
              ? undefined
              : () => {
                  setError('');
                  setAttempt((n) => n + 1);
                }
          }
        />
      )}
      {!items && !error && <p role="status">{tr('ScheduleEditor.loadingDefaultTasks')}</p>}
      {items && (
        <fieldset disabled={busy} className="work-task-editor">
          {items.length === 0 && <p>{tr('WorkTasks.noDefaultTasksLinked')}</p>}
          <ol className="work-task-list">
            {items.map((item, index) => (
              <li key={item.id} className="memo-preview">
                <a href={'#/presets/tasks/' + item.id}>{item.name}</a>
                {item.archived && (
                  <span className="tag">
                    {tr('WorkTasks.archivedExcludedFromScheduleSelection')}
                  </span>
                )}
                <div className="work-task-actions">
                  <PresetMemoButton kind="task" id={item.id} name={item.name} />
                  <Button
                    iconOnly
                    variant="ghost"
                    type="button"
                    aria-label={tr('ScheduleEditor.moveValueUp', { v1: item.name })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ActionIcon name="up" />
                  </Button>
                  <Button
                    iconOnly
                    variant="ghost"
                    type="button"
                    aria-label={tr('ScheduleEditor.moveValueDown', { v1: item.name })}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ActionIcon name="down" />
                  </Button>
                  <Button
                    iconOnly
                    variant="ghost"
                    type="button"
                    aria-label={tr('WorkTasks.unlinkValue', { v1: item.name })}
                    title={tr('WorkTasks.unlink')}
                    onClick={() => change(items.filter((x) => x.id !== item.id))}
                  >
                    <ActionIcon name="trash" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <label>
            {tr('WorkTasks.searchTasksToLink')}
            <Input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
                setPage(undefined);
                setSearchError('');
              }}
            />
          </label>
          {searchError && (
            <ErrorBox
              error={searchError}
              retry={() => {
                setSearchError('');
                setSearchAttempt((n) => n + 1);
              }}
            />
          )}
          {!page && !searchError && <p role="status">{tr('WorkTasks.searchingTasks')}</p>}
          {page && (
            <>
              <ul className="work-task-list">
                {page.items.map((item) => (
                  <li key={item.id} className="memo-preview">
                    <span>{item.name}</span>
                    <PresetMemoButton
                      kind="task"
                      id={item.id}
                      name={item.name}
                      notes={item.default_notes}
                    />
                    <IconButton
                      icon="plus"
                      type="button"
                      disabled={items.some((x) => x.id === item.id) || items.length >= 100}
                      onClick={() =>
                        change([
                          ...items,
                          { id: item.id, name: item.name, archived: false, position: items.length },
                        ])
                      }
                    >
                      {items.some((x) => x.id === item.id)
                        ? tr('WorkTasks.linked')
                        : tr('WorkTasks.add')}
                    </IconButton>
                  </li>
                ))}
              </ul>
              {page.total === 0 && <p>{tr('WorkTasks.noTasksFoundCreateTasksInTheTasksTab')}</p>}
              <div className="work-task-actions">
                <IconButton
                  icon="left"
                  disabled={offset === 0}
                  onClick={() => {
                    setOffset(offset - 20);
                    setPage(undefined);
                  }}
                >
                  {tr('Picker.previous')}
                </IconButton>
                <span>
                  {tr('WorkTasks.valueValueOfValue', {
                    v1: page.total,
                    v2: page.total ? offset + 1 : 0,
                    v3: offset + page.items.length,
                  })}
                </span>
                <IconButton
                  icon="right"
                  disabled={offset + page.items.length >= page.total}
                  onClick={() => {
                    setOffset(offset + 20);
                    setPage(undefined);
                  }}
                >
                  {tr('Picker.next')}
                </IconButton>
              </div>
            </>
          )}
          <p>{tr('WorkTasks.upTo100TasksExistingLinksToArchivedTasks')}</p>
          <div className="work-task-actions">
            <IconButton icon="save" disabled={!dirty} onClick={() => void save()}>
              {busy ? tr('Photos.saving') : tr('WorkTasks.saveDefaultTasks')}
            </IconButton>
            <Button
              iconOnly
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                change(saved ?? []);
                setError('');
              }}
              aria-label={tr('MemoEditor.cancelChanges')}
              title={tr('MemoEditor.cancelChanges')}
            >
              <ActionIcon name="close" />
            </Button>
          </div>
          {dirty && <p role="status">{tr('WorkTasks.youHaveUnsavedChanges')}</p>}
        </fieldset>
      )}
      {status && <p role="status">{displayMessage(status)}</p>}
    </Surface>
  );
}
