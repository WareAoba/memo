import { ModalActions } from '../shared/PresetModal';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { PageHeader, Surface, Input, Textarea, Button } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { DetailKindInput } from './DetailKindInput';
import { useId, useState } from 'react';
import { useEditorActive } from '../useEditorActive';
import { emptyFields, saveWork } from '../../api/works';
import type { WorkFields, Work } from '../../api/works';
import { ErrorBox } from '../shared/ErrorBox';
import { message, go, parseTags } from '../shared/form';
import { TagInput } from '../shared/TagInput';
import { useNames } from '../shared/useNames';
export function WorkEditor({
  initial,
  id,
  embedded = false,
  hideMemo = false,
  onDone,
}: {
  initial: WorkFields;
  id?: string;
  embedded?: boolean;
  hideMemo?: boolean;
  onDone?: (saved: Work) => void;
  onCancel?: () => void;
}) {
  useTranslation();
  const formId = useId();
  const catalog = useNames('/api/work-field-names');
  const [custom, setCustom] = useState(
    initial.custom_fields?.length ? initial.custom_fields : [{ name: '', value: '' }],
  );
  const active = useEditorActive();
  const [fields, setFields] = useState<WorkFields>(
    () =>
      Object.fromEntries(
        Object.keys(emptyFields).map((k) => [k, initial[k as keyof WorkFields]]),
      ) as WorkFields,
  );
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function set<K extends keyof WorkFields>(key: K, value: WorkFields[K]) {
    setFields((old) => ({ ...old, [key]: value }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!fields.name.trim()) {
      setError('WorkEditor.enterAWorkName');
      return;
    }
    const names = custom.map((field) => field.name.trim()).filter(Boolean);
    if (new Set(names).size !== names.length) {
      setError('WorkEditor.theSameTypeCannotBeUsedTwice');
      return;
    }
    setSaving(true);
    const savePath = window.location.hash;
    try {
      const editable: Partial<WorkFields> = {
        ...fields,
        custom_fields: custom.filter((field) => field.name.trim() || field.value.trim()),
      };
      delete editable.archived;
      if (hideMemo) delete editable.general_notes;
      const result = await saveWork(
        { ...editable, tags: tags === initial.tags.join(', ') ? initial.tags : parseTags(tags) },
        id,
      );
      if (active.current && window.location.hash === savePath) {
        if (onDone) onDone(result);
        else go('/presets/works/' + result.id);
      }
    } catch (e) {
      if (!active.current) return;
      setError(message(e));
      setSaving(false);
    }
  }
  return (
    <>
      {!embedded && (
        <PageHeader className="page-heading">
          <div>
            <h1>{id ? tr('WorkDetail.editWork') : tr('WorkEditor.createNewWork')}</h1>
          </div>
        </PageHeader>
      )}
      <form id={formId} className="editor" onSubmit={submit}>
        <Surface as="fieldset" disabled={saving}>
          <legend className="sr-only">{tr('WorkEditor.workInformation')}</legend>
          <div className="form-grid">
            <label className="wide">
              {tr('WorkEditor.workName')}
              <Input
                value={fields.name}
                required
                maxLength={200}
                onChange={(e) => set('name', e.target.value)}
                placeholder={tr('WorkEditor.eGEnglishFitnessClientA')}
              />
            </label>
            {!hideMemo && (
              <label className="wide">
                {tr('fields.descriptionAndNotes')}
                <Textarea
                  rows={3}
                  maxLength={5000}
                  value={fields.general_notes}
                  onChange={(e) => set('general_notes', e.target.value)}
                  placeholder={tr('WorkEditor.describeWhatThisWorkIsFor')}
                />
              </label>
            )}
            <TagInput value={tags} onChange={setTags} />
          </div>
        </Surface>
        <Surface as="fieldset" disabled={saving}>
          <legend>{tr('Picker.details')}</legend>
          {catalog.error && <ErrorBox error={catalog.error} />}
          {custom.map((field, index) => (
            <Surface
              as="section"
              className="custom-detail-card"
              aria-label={tr('WorkEditor.detailValue', { v1: index + 1 })}
              key={index}
            >
              <div className="custom-detail-heading">
                <Button
                  iconOnly
                  variant="ghost"
                  type="button"
                  className="custom-detail-remove"
                  aria-label={tr('WorkEditor.deleteDetailValue', { v1: index + 1 })}
                  title={tr('design-reference.delete')}
                  onClick={() => setCustom((rows) => rows.filter((_, i) => i !== index))}
                >
                  <ActionIcon name="trash" />
                </Button>
              </div>
              <label>
                {tr('Schedules.content')}
                <Textarea
                  rows={3}
                  maxLength={5000}
                  value={field.value}
                  onChange={(e) =>
                    setCustom((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, value: e.target.value } : row)),
                    )
                  }
                />
              </label>
              <DetailKindInput
                value={field.name}
                names={catalog.names.filter(
                  (name) => !custom.some((row, i) => i !== index && row.name.trim() === name),
                )}
                onChange={(name) =>
                  setCustom((rows) => rows.map((row, i) => (i === index ? { ...row, name } : row)))
                }
              />
            </Surface>
          ))}
          <IconButton
            icon="plus"
            type="button"
            className="custom-detail-add"
            disabled={custom.length >= 100}
            onClick={() => setCustom((rows) => [...rows, { name: '', value: '' }])}
          >
            <span aria-hidden="true">＋</span> {tr('WorkEditor.addDetail')}
          </IconButton>
        </Surface>
        {error && <ErrorBox error={error} />}
        <ModalActions>
          <div className="actions">
            <IconButton variant="primary" icon="save" form={formId} type="submit" disabled={saving}>
              {saving ? tr('Photos.saving') : tr('WorkEditor.saveWork')}
            </IconButton>
          </div>
        </ModalActions>
      </form>
    </>
  );
}
