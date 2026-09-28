import type { ScheduleDetail } from './schedules';

export type ScheduleChange =
  | { kind: 'saved'; id: string; schedule: ScheduleDetail }
  | { kind: 'deleted'; id: string }
  | { kind: 'reset' | 'presets' };

let generation = 0;
export const scheduleGeneration = () => generation;

export function publishScheduleChange(change: ScheduleChange) {
  generation++;
  window.dispatchEvent(new CustomEvent<ScheduleChange>('schedules-changed', { detail: change }));
}

export function scheduleChange(event: Event): ScheduleChange | undefined {
  return event instanceof CustomEvent ? (event.detail as ScheduleChange | undefined) : undefined;
}
