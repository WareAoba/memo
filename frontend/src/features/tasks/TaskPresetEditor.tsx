import { UnmanagedSuggestions } from '../shared/UnmanagedSuggestions';
import { ModalActions } from '../shared/PresetModal';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { PageHeader, Surface, Input, Textarea, Button } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { useId, useState } from 'react';
import { useEditorActive } from '../useEditorActive';
import { emptyFields, saveTaskPreset } from '../../api/taskPresets';
import type { TaskPresetFields, TaskPreset } from '../../api/taskPresets';
import { ErrorBox } from '../shared/ErrorBox';
import { message, go, parseTags } from '../shared/form';
import { TagInput } from '../shared/TagInput';
import { useNames } from '../shared/useNames';
import { DetailKindInput } from '../works/DetailKindInput';
import { PresetItemsEditor, type ItemDraft } from './PresetItemsEditor';
export function TaskPresetEditor({
  initial = emptyFields,
  id,
  embedded = false,
  hideMemo = false,
  onDone,
  onCancel,
}: {
  initial?: TaskPresetFields;
  id?: string;
  embedded?: boolean;
  hideMemo?: boolean;
  onDone?: (saved: TaskPreset) => void;
  onCancel?: () => void;
}) {
  useTranslation();
  const formId = useId();
  const catalog = useNames('/api/task-groups');
  const templateHint = useId();
  const [group, setGroup] = useState(initial.group_name ?? '');
  const active = useEditorActive();
  const [name, setName] = useState(initial.name);
  const [notes, setNotes] = useState(initial.default_notes);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>(() =>
    initial.items.map((item) => ({
      key: item.id ?? crypto.randomUUID(),
      item: { ...item },
    })),
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('TaskPresetEditor.enterATaskName');
      return;
    }
    const definitions = items.map(({ item }, position) => ({
      ...item,
      position,
      default_value:
        item.item_type === 'number'
          ? item.default_value === null || String(item.default_value).trim() === ''
            ? null
            : Number(item.default_value)
          : item.default_value,
    }));
    if (
      definitions.some(
        (item) =>
          !item.label.trim() ||
          (typeof item.default_value === 'number' && !Number.isFinite(item.default_value)),
      )
    ) {
      setError('TaskPresetEditor.enterItemNamesAndValidDefaultValues');
      return;
    }
    setSaving(true);
    const savePath = window.location.hash;
    try {
      const saved = await saveTaskPreset(
        {
          name,
          group_name: group,
          ...(!hideMemo ? { default_notes: notes } : {}),
          tags: tags === initial.tags.join(', ') ? initial.tags : parseTags(tags),
          items: definitions,
        },
        id,
      );
      if (active.current && window.location.hash === savePath) {
        if (onDone) onDone(saved);
        else go('/presets/tasks/' + saved.id);
      }
    } catch (e) {
      if (!active.current) return;
      setError(message(e));
      setSaving(false);
    }
  }
  return (
    <>
      {!onDone && (
        <nav className="breadcrumb">
          <a href="#/presets/tasks">{tr('TaskPresetDetail.tasks')}</a>
          <span>/ {id ? tr('App.edit') : tr('App.create')}</span>
        </nav>
      )}
      {!embedded && (
        <PageHeader className="page-heading">
          <div>
            <h1>{id ? tr('TaskPresetDetail.editTask') : tr('TaskPresetEditor.createNewTask')}</h1>
          </div>
        </PageHeader>
      )}
      <form id={formId} className="editor" onSubmit={submit}>
        <Surface as="fieldset" disabled={saving}>
          <legend className="sr-only">{tr('TaskPresetEditor.taskInformation')}</legend>
          <div className="form-grid">
            <label className="wide">
              {tr('TaskPresetEditor.taskName')}
              <Input
                aria-label={tr('TaskPresetEditor.taskName')}
                aria-describedby={templateHint}
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('TaskPresetEditor.eGMemorizeN5Words')}
              />
            </label>
            <details className="inline-help wide">
              <summary>{tr('UI.parameterHelp')}</summary>
              <p id={templateHint} className="hint">
                {tr('TaskPresetEditor.useNOrCountToEnterValuesInA')}
              </p>
            </details>
            {!id && <UnmanagedSuggestions kind="task" name={name} onSelect={setName} />}
            {!hideMemo && (
              <label className="wide">
                {tr('TaskPresetDetail.defaultMemo')}
                <Textarea
                  rows={3}
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            )}
            <div className="wide">
              <DetailKindInput
                label={tr('ScheduleEditor.taskGroups')}
                value={group}
                names={catalog.names}
                onChange={setGroup}
              />
            </div>
            {catalog.error && <ErrorBox error={catalog.error} />}
            <TagInput value={tags} onChange={setTags} />
          </div>
        </Surface>
        <PresetItemsEditor items={items} onChange={setItems} disabled={saving} />
        {error && <ErrorBox error={error} />}
        <ModalActions>
          <div className="actions">
            <Button
              variant="primary"
              form={formId}
              type="submit"
              disabled={saving}
              aria-busy={saving || undefined}
            >
              <ActionIcon name="save" />
              {saving ? tr('Photos.saving') : tr('TaskPresetEditor.saveTask')}
            </Button>
            {!embedded && (
              <Button
                iconOnly
                variant="ghost"
                type="button"
                disabled={saving}
                onClick={() => (onCancel ? onCancel() : go('/presets/tasks'))}
                aria-label={tr('Photos.cancel')}
                title={tr('Photos.cancel')}
              >
                <ActionIcon name="close" />
              </Button>
            )}
          </div>
        </ModalActions>
      </form>
    </>
  );
}
