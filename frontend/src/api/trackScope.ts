// Each browser tab owns its selection. Requests capture this value when they start.
export type TrackScope = { accountId: string; trackId: string; generation: number };
let active: TrackScope = { accountId: '', trackId: '', generation: 0 };
let writes = 0;
export const currentTrackScope = () => active;
export const trackScopeKey = () => `${active.accountId}:${active.trackId}:${active.generation}`;
export function selectTrackScope(accountId: string, trackId: string) {
  active = { accountId, trackId, generation: active.generation + 1 };
}
export function isTrackRequest(path: string) {
  return (
    /^\/api\/(entities|task-presets|schedule-tasks|schedule-task-items|schedules|photos|unmanaged-presets|work-field-names|task-groups)(\/|\?|$)/.test(
      path,
    ) || path === '/api/settings/reset'
  );
}
export function trackHeaders(): Record<string, string> {
  return active.trackId ? { 'X-Track-Id': active.trackId } : {};
}
export function beginTrackWrite() {
  writes++;
  return () => {
    writes--;
  };
}
export const hasTrackWrites = () => writes > 0;
