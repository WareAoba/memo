import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { DatePicker } from '../shared/DateTimePicker';
import { useSettings } from '../settings/settingsContext';
import { TimeEndpoint } from './TimeEndpoint';
import { orderedDates, toMinutes, toTime } from './timeRange';

type DateRange = { scheduled_date: string; end_date: string; start_time: string; end_time: string };
export function ScheduleDateRange({
  value,
  onChange,
  disabled = false,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  disabled?: boolean;
}) {
  useTranslation();
  const step = useSettings().values.clock_step;
  function allowed(endpoint: 'start' | 'end', time: string) {
    return (
      value.scheduled_date !== value.end_date ||
      (endpoint === 'start' ? !value.end_time || time < value.end_time : time > value.start_time)
    );
  }
  function changeTime(endpoint: 'start' | 'end', time: string) {
    onChange({
      ...value,
      [endpoint === 'start' ? 'start_time' : 'end_time']: time,
      ...(endpoint === 'start' && !time ? { end_time: '' } : {}),
    });
  }
  return (
    <div className="manual-time-range time-endpoints">
      {(['start', 'end'] as const).map((endpoint) => {
        const date = (
          <DatePicker
            hideLabel
            label={tr(endpoint === 'start' ? 'ScheduleEditor.startDate' : 'ScheduleEditor.endDate')}
            value={endpoint === 'start' ? value.scheduled_date : value.end_date}
            disabled={disabled}
            onChange={(date) =>
              onChange({
                ...value,
                ...orderedDates(
                  endpoint === 'start' ? date : value.scheduled_date,
                  endpoint === 'end' ? date : value.end_date,
                ),
              })
            }
          />
        );
        const time = endpoint === 'start' ? value.start_time : value.end_time;
        return (
          <fieldset key={endpoint} className="schedule-date-section" disabled={disabled}>
            <legend>{tr(endpoint === 'start' ? 'TaskExecution.start' : 'TimeDial.end')}</legend>
            {date}
            <TimeEndpoint
              endpoint={endpoint}
              labelled
              value={time}
              disabled={disabled}
              isAllowed={(time) => allowed(endpoint, time)}
              onChange={(time) => changeTime(endpoint, time)}
              onStep={(direction) => {
                const next = toTime(
                  Math.max(0, Math.min(1439, toMinutes(time) + direction * step)),
                );
                if (allowed(endpoint, next)) changeTime(endpoint, next);
              }}
            />
          </fieldset>
        );
      })}
    </div>
  );
}
