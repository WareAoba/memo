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
  daySpan = 0,
) {
  const s = start ? toMinutes(start) : 0;
  const endDay = !start && end && target === 'start' && minute >= toMinutes(end) ? 1 : daySpan;
  const e = end ? toMinutes(end) + endDay * 1440 : 0;
  const min = target === 'start' ? (end ? Math.max(0, e - 1440) : 0) : start ? s + 1 : 0;
  const max = target === 'start' ? (end ? Math.min(1439, e - 1) : 1439) : start ? s + 1440 : 1439;
  const value = Math.max(min, Math.min(max, Math.round(minute / step) * step));
  const nextStart = target === 'start' ? toTime(value) : start;
  const nextEnd = target === 'end' ? toTime(value % 1440) : end;
  return {
    start: nextStart,
    end: nextEnd,
    daySpan: target === 'end' ? Math.floor(value / 1440) : endDay,
  };
}
export function dateSpan(start: string, end: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}
export function scheduleMinutes(fields: {
  scheduled_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
}) {
  return (
    dateSpan(fields.scheduled_date, fields.end_date) * 1440 +
    toMinutes(fields.end_time) -
    toMinutes(fields.start_time)
  );
}
export function orderedDates(start: string, end: string) {
  return { scheduled_date: start <= end ? start : end, end_date: start <= end ? end : start };
}
export function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + 1);
  const result = d.toISOString().slice(0, 10);
  return result.startsWith('+') ? date : result;
}
// Cache formatters, never dates or offsets: DST and date boundaries remain live.
const zoneFormatters = new Map<string, { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();
function formattersInZone(zone: string) {
  let formatters = zoneFormatters.get(zone);
  if (!formatters) {
    formatters = {
      date: new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      time: new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    if (zoneFormatters.size >= 64) zoneFormatters.delete(zoneFormatters.keys().next().value!);
    zoneFormatters.set(zone, formatters);
  }
  return formatters;
}
export function dateInZone(zone: string, now = new Date()) {
  const parts = formattersInZone(zone).date.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function timeInZone(zone: string, now = new Date()) {
  return formattersInZone(zone).time.format(now);
}
