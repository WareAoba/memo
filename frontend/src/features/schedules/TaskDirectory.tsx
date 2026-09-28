import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listTaskPresets, type TaskPresetSummary } from '../../api/taskPresets';
import { tr } from '../../i18n';
import { Button, DisclosureSummary, Input } from '../shared/ui';
import { ModalActions, PresetModal } from '../shared/PresetModal';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import type { TaskChoice } from './TaskNameInput';

export function TaskDirectory({
  existing,
  capacity,
  onAdd,
  onClose,
  preview,
}: {
  existing: TaskChoice[];
  capacity: number;
  onAdd: (choices: TaskChoice[]) => void;
  onClose: () => void;
  preview?: TaskPresetSummary[];
}) {
  useTranslation();
  const [items, setItems] = useState<TaskPresetSummary[]>(preview ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    async function load() {
      try {
        const all: TaskPresetSummary[] = [];
        let offset = 0;
        while (!controller.signal.aborted) {
          const page = await listTaskPresets('', false, offset, controller.signal, 100);
          all.push(...page.items);
          offset += page.items.length;
          if (offset >= page.total || !page.items.length) break;
        }
        if (!controller.signal.aborted) {
          setItems(all);
          setLoading(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(message(e));
          setLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt, preview]);
  const groups = Array.from(new Set(items.map((item) => item.group_name || '')));
  return (
    <PresetModal label={tr('TaskDirectory.title')} onClose={onClose}>
      {error && (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setLoading(true);
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {!loading && !error && !items.length && <p>{tr('TaskDirectory.empty')}</p>}
      <div className="task-directory">
        {groups.map((group) => (
          <details key={group} open>
            <DisclosureSummary>{group || tr('TaskDirectory.ungrouped')}</DisclosureSummary>
            <ul>
              {items
                .filter((item) => (item.group_name || '') === group)
                .map((item) => {
                  const included = existing.some(
                    (row) => row.id === item.id || row.name.trim() === item.name.trim(),
                  );
                  const checked = selected.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label>
                        <Input
                          type="checkbox"
                          checked={included || checked}
                          disabled={included || (!checked && selected.length >= capacity)}
                          onChange={() =>
                            setSelected((ids) =>
                              checked ? ids.filter((id) => id !== item.id) : [...ids, item.id],
                            )
                          }
                        />
                        {item.name}
                      </label>
                    </li>
                  );
                })}
            </ul>
          </details>
        ))}
      </div>
      <ModalActions>
        <Button
          variant="primary"
          disabled={!selected.length || loading || Boolean(error)}
          onClick={() => {
            onAdd(
              selected.flatMap((id) => {
                const item = items.find((row) => row.id === id);
                return item ? [item] : [];
              }),
            );
            onClose();
          }}
        >
          {tr('TaskDirectory.add')} ({selected.length})
        </Button>
      </ModalActions>
    </PresetModal>
  );
}
