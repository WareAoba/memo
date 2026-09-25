import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface, Input, Select } from '../shared/ui';
import type { PresetItem } from '../../api/taskPresets';
import { IconButton } from '../shared/IconButton';
import { types } from './itemTypes';

export type ItemDraft = { key: string; item: PresetItem };

export function PresetItemsEditor({
  items,
  onChange,
  disabled,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  disabled: boolean;
}) {
  useTranslation();
  function change(key: string, changes: Partial<PresetItem>) {
    onChange(
      items.map((entry) =>
        entry.key === key ? { ...entry, item: { ...entry.item, ...changes } } : entry,
      ),
    );
  }
  function move(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    onChange(next);
  }
  return (
    <Surface as="fieldset" disabled={disabled}>
      <legend>{tr('PresetItemsEditor.taskItems')}</legend>
      {!items.length && (
        <p className="hint">{tr('PresetItemsEditor.addCheckboxTextOrNumberFieldsAsNeeded')}</p>
      )}
      {items.map(({ key, item }, index) => (
        <Surface as="fieldset" key={key} className="detail-section">
          <legend>{tr('PresetItemsEditor.itemValue', { v1: index + 1 })}</legend>
          <div className="form-grid">
            <label>
              {tr('PresetItemsEditor.itemName')}
              <Input
                required
                maxLength={200}
                value={item.label}
                onChange={(event) => change(key, { label: event.target.value })}
              />
            </label>
            <label>
              {tr('PresetItemsEditor.type')}
              <Select
                value={item.item_type}
                onChange={(event) =>
                  change(key, {
                    item_type: event.target.value as PresetItem['item_type'],
                    default_value: null,
                    unit: '',
                  })
                }
              >
                {Object.entries(types).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <Input
                type="checkbox"
                checked={item.required}
                onChange={(event) => change(key, { required: event.target.checked })}
              />
              {tr('PresetItemsEditor.required')}
            </label>
            <label>
              {tr('PresetItemsEditor.defaultValueValue')}
              {item.item_type === 'checkbox' ? (
                <Input
                  type="checkbox"
                  checked={item.default_value === true}
                  onChange={(event) => change(key, { default_value: event.target.checked })}
                />
              ) : (
                <Input
                  type={item.item_type === 'number' ? 'number' : 'text'}
                  step={item.item_type === 'number' ? 'any' : undefined}
                  maxLength={5000}
                  value={String(item.default_value ?? '')}
                  onChange={(event) => change(key, { default_value: event.target.value })}
                />
              )}
            </label>
            {item.item_type === 'number' && (
              <label>
                {tr('PresetItemsEditor.unit')}
                <Input
                  maxLength={50}
                  value={item.unit}
                  onChange={(event) => change(key, { unit: event.target.value })}
                />
              </label>
            )}
          </div>
          <div className="work-task-actions">
            <IconButton
              icon="up"
              type="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              {tr('PresetItemsEditor.moveItemValueUp', { v1: index + 1 })}
            </IconButton>
            <IconButton
              icon="down"
              type="button"
              disabled={index === items.length - 1}
              onClick={() => move(index, 1)}
            >
              {tr('PresetItemsEditor.moveItemValueDown', { v1: index + 1 })}
            </IconButton>
            <IconButton
              icon="trash"
              type="button"
              onClick={() => onChange(items.filter((entry) => entry.key !== key))}
            >
              {tr('PresetItemsEditor.deleteItemValue', { v1: index + 1 })}
            </IconButton>
          </div>
        </Surface>
      ))}
      <IconButton
        icon="plus"
        type="button"
        disabled={items.length >= 100}
        onClick={() =>
          onChange([
            ...items,
            {
              key: crypto.randomUUID(),
              item: {
                position: items.length,
                label: '',
                item_type: 'checkbox',
                required: false,
                default_value: null,
                unit: '',
              },
            },
          ])
        }
      >
        {tr('PresetItemsEditor.addItem')}
      </IconButton>
    </Surface>
  );
}
