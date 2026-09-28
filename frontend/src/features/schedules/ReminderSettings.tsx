import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input } from '../shared/ui';
import '../shared/toast.css';
import { DropdownSelect } from '../shared/DropdownSelect';

import { reminderUnits, type ReminderFields, type ReminderUnit } from '../../api/reminderFields';
const limits = { minutes: 10080, hours: 168, days: 7 };

export function ReminderSettings({
  value,
  disabled = false,
  onChange,
}: {
  value: ReminderFields;
  disabled?: boolean;
  onChange: (value: ReminderFields) => void;
}) {
  useTranslation();
  const unit = value.reminder_unit === 'weeks' ? 'days' : (value.reminder_unit ?? 'minutes');
  const amount =
    value.reminder_unit === 'weeks' ? (value.reminder_value ?? 1) * 7 : value.reminder_value;
  return (
    <div className="reminder-settings">
      <label className="reminder-toggle">
        <Input
          type="checkbox"
          disabled={disabled}
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
              value={Number.isNaN(amount) ? '' : (amount ?? 15)}
              onChange={(e) =>
                onChange({ ...value, reminder_value: e.target.valueAsNumber, reminder_unit: unit })
              }
            />
            <DropdownSelect
              hideLabel
              disabled={disabled}
              label={tr('ReminderSettings.reminderUnit')}
              value={unit}
              onChange={(unit) =>
                onChange({ ...value, reminder_value: amount, reminder_unit: unit as ReminderUnit })
              }
              options={Object.entries(reminderUnits).map(([value, label]) => ({ value, label }))}
            />
            <span>{tr('ReminderSettings.beforeTheStart')}</span>
          </div>
          <p className="hint">{tr('ReminderSettings.setUpTo7DaysInAdvanceToReceive')}</p>
        </>
      )}
    </div>
  );
}
