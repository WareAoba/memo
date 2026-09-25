import { useEffect, useState } from 'react';
import { dateKey } from './preview';
import { dateInZone } from '../schedules/timeRange';

export function useToday(timeZone?: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setNow(now);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(
        refresh,
        timeZone
          ? 60000 - now.getSeconds() * 1000 - now.getMilliseconds()
          : midnight.getTime() - now.getTime(),
      );
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [timeZone]);
  return timeZone ? dateInZone(timeZone, now) : dateKey(now);
}
