import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface, Button } from '../shared/ui';
import { useEffect, useState } from 'react';
import { listTaskPresets, type TaskPresetList } from '../../api/taskPresets';
import { useNames } from '../shared/useNames';
import { ErrorBox } from '../shared/ErrorBox';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetMemoButton } from '../shared/PresetMemoButton';
import { message } from '../shared/form';
export function TaskGroupPicker({
  selected,
  onPick,
}: {
  selected: string[];
  onPick: (task: { id: string; name: string }) => void;
}) {
  useTranslation();
  const [group, setGroup] = useState<string>();
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const groups = useNames('/api/task-groups', attempt);
  const [page, setPage] = useState<TaskPresetList>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (group === undefined) return;
    const c = new AbortController();
    listTaskPresets('', false, offset, c.signal, 20, group)
      .then((v) => {
        if (!c.signal.aborted) setPage(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [group, offset, attempt]);
  function navigate(next: string | undefined, start = 0) {
    setGroup(next);
    setOffset(start);
    setPage(undefined);
    setError('');
  }
  return (
    <div className="task-group-browser">
      <p className="hint">{tr('TaskGroupPicker.expandAGroupToAddTasks')}</p>
      {groups.error && <ErrorBox error={groups.error} retry={() => setAttempt((n) => n + 1)} />}
      <div className="task-group-accordion">
        {[...groups.names.filter(Boolean), ''].map((name) => (
          <Surface as="section" padding="none" className="task-group-section" key={name}>
            <Button
              variant="option"
              type="button"
              className="task-group-heading"
              aria-expanded={group === name}
              onClick={() => navigate(group === name ? undefined : name)}
            >
              <strong>{name || tr('TaskGroupPicker.ungrouped')}</strong>
              <ActionIcon name={group === name ? 'up' : 'down'} />
            </Button>
            <div
              className={`task-group-expansion${group === name ? ' is-open' : ''}`}
              inert={group !== name}
              aria-hidden={group !== name}
            >
              <div>
                {group === name && (
                  <div className="task-group-contents">
                    {error && (
                      <ErrorBox
                        error={error}
                        retry={() => {
                          setError('');
                          setAttempt((n) => n + 1);
                        }}
                      />
                    )}
                    {!page && !error && <p role="status">{tr('TaskGroupPicker.loadingTasks')}</p>}
                    <div className="task-group-options">
                      {page?.items.map((task) => (
                        <div key={task.id} className="picker-result memo-preview">
                          <Button
                            variant="option"
                            key={task.id}
                            type="button"
                            disabled={selected.includes(task.id) || selected.length >= 100}
                            aria-label={
                              task.name +
                              (selected.includes(task.id)
                                ? tr('TaskGroupPicker.added')
                                : tr('TaskGroupPicker.add'))
                            }
                            onClick={() => onPick(task)}
                          >
                            <span>{task.name}</span>
                            <ActionIcon name={selected.includes(task.id) ? 'check' : 'plus'} />
                          </Button>
                          <PresetMemoButton
                            kind="task"
                            id={task.id}
                            name={task.name}
                            notes={task.default_notes}
                          />
                        </div>
                      ))}
                    </div>
                    {page?.total === 0 && (
                      <p className="hint">{tr('TaskGroupPicker.noTasksInThisGroup')}</p>
                    )}
                    {page && (page.total > 20 || offset > 0) && (
                      <div className="work-task-actions">
                        <IconButton
                          icon="left"
                          type="button"
                          disabled={!offset}
                          onClick={() => navigate(group, offset - 20)}
                        >
                          {tr('TaskGroupPicker.previousTasks')}
                        </IconButton>
                        <span>
                          {offset + 1}–{offset + page.items.length} / {page.total}
                        </span>
                        <IconButton
                          icon="right"
                          type="button"
                          disabled={offset + 20 >= page.total}
                          onClick={() => navigate(group, offset + 20)}
                        >
                          {tr('TaskGroupPicker.nextTasks')}
                        </IconButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
