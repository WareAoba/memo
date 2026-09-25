export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function pointToMinutes(x: number, y: number, step = 5) {
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  return Math.min(1440 - step, Math.round(((angle / (Math.PI * 2)) * 1440) / step) * step);
}
export function changeRange(
  start: string,
  end: string,
  target: 'start' | 'end',
  minute: number,
  step = 5,
) {
  const value = Math.max(0, Math.min(1440 - step, Math.round(minute / step) * step));
  const fixed = toMinutes(target === 'start' ? end : start);
  if (value === fixed) return { start, end };
  return { start: toTime(Math.min(value, fixed)), end: toTime(Math.max(value, fixed)) };
}
export function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + 1);
  const result = d.toISOString().slice(0, 10);
  return result.startsWith('+') ? date : result;
}
export function dateInZone(zone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
