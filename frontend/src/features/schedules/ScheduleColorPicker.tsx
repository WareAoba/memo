import { useId } from 'react';
import { tr } from '../../i18n';
import { scheduleColors, type ScheduleColor } from '../../api/scheduleColors';
import { Input } from '../shared/ui';

export function ScheduleColorPicker({
  value,
  onChange,
}: {
  value: ScheduleColor;
  onChange: (value: ScheduleColor) => void;
}) {
  const id = useId();
  return (
    <fieldset className="schedule-color-picker">
      <legend className="sr-only">{tr('ScheduleColor.label')}</legend>
      <div className="schedule-color-options">
        {scheduleColors.map((color) => (
          <label key={color} title={tr(`ScheduleColor.${color}`)}>
            <Input
              className="sr-only"
              type="radio"
              name={id}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
            />
            <span className="schedule-color-dot" data-schedule-color={color} aria-hidden="true" />
            <span className="sr-only">{tr(`ScheduleColor.${color}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
