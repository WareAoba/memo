export const scheduleColors = [
  'none',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
] as const;
export type ScheduleColor = (typeof scheduleColors)[number];
