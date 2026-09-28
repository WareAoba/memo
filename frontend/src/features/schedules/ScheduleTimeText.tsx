import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';

export function ScheduleTimeText({ start, end }: { start: string; end: string }) {
  useTranslation();
  if (!start) return <span className="time-unspecified">{tr('DateTime.unspecified')}</span>;
  if (!end) return <>{tr('DateTime.startOnly', { time: start })}</>;
  return (
    <>
      {start} — {end}
    </>
  );
}
