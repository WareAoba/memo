import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input, Select } from '../shared/ui';
import '../shared/toast.css';

import { reminderUnits, type ReminderFields, type ReminderUnit } from '../../api/reminderFields';
const limits = { minutes: 525600, hours: 8760, days: 365, weeks: 52 };

export function ReminderSettings({
  value,
  onChange,
}: {
  value: ReminderFields;
  onChange: (value: ReminderFields) => void;
}) {
  useTranslation();
  const unit = value.reminder_unit ?? 'minutes';
  return (
    <div className="reminder-settings">
      <label className="reminder-toggle">
        <Input
          type="checkbox"
          checked={value.reminder_enabled ?? false}
          onChange={(e) =>
            onChange({
              ...value,
              reminder_enabled: e.target.checked,
              ...(!e.target.checked &&
              (!Number.isInteger(value.reminder_value ?? 15) ||
                (value.reminder_value ?? 15) < 1 ||
                (value.reminder_value ?? 15) > limits[unit])
                ? { reminder_value: 15, reminder_unit: 'minutes' }
                : {}),
            })
          }
        />
        {tr('ReminderSettings.reminder')}
      </label>
      {value.reminder_enabled && (
        <>
          <div className="reminder-controls">
            <Input
              aria-label={tr('ReminderSettings.reminderAmount')}
              type="number"
              required
              min={1}
              max={limits[unit]}
              step={1}
              value={Number.isNaN(value.reminder_value) ? '' : (value.reminder_value ?? 15)}
              onChange={(e) => onChange({ ...value, reminder_value: e.target.valueAsNumber })}
            />
            <Select
              aria-label={tr('ReminderSettings.reminderUnit')}
              value={unit}
              onChange={(e) =>
                onChange({ ...value, reminder_unit: e.target.value as ReminderUnit })
              }
            >
              {Object.entries(reminderUnits).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <span>{tr('ReminderSettings.beforeTheStart')}</span>
          </div>
          <p className="hint">{tr('ReminderSettings.setUpTo365DaysInAdvanceToReceive')}</p>
        </>
      )}
    </div>
  );
}
