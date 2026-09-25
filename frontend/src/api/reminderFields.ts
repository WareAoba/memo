import { tr } from '../i18n';
const unitKeys = {
  minutes: 'reminderFields.min',
  hours: 'reminderFields.hours',
  days: 'reminderFields.days',
  weeks: 'reminderFields.weeks',
} as const;
export const reminderUnitLabel = (unit: ReminderUnit, count?: number) =>
  tr(unitKeys[unit], { count });
export const reminderUnits = {
  get minutes() {
    return tr('reminderFields.min');
  },
  get hours() {
    return tr('reminderFields.hours');
  },
  get days() {
    return tr('reminderFields.days');
  },
  get weeks() {
    return tr('reminderFields.weeks');
  },
};
export type ReminderUnit = keyof typeof reminderUnits;
export type ReminderFields = {
  reminder_enabled?: boolean;
  reminder_value?: number;
  reminder_unit?: ReminderUnit;
};
