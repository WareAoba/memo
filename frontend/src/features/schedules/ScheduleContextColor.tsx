import { useRef, useState } from 'react';
import { saveSchedule, type ScheduleDetail } from '../../api/schedules';
import type { ScheduleColor } from '../../api/scheduleColors';
import { ContextMenuSlot } from '../shared/ContextMenuSlot';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { ScheduleColorPicker } from './ScheduleColorPicker';

export function ScheduleContextColor({
  id,
  color = 'none',
  disabled,
  onSaved,
}: {
  id: string;
  color?: ScheduleColor;
  disabled?: boolean;
  onSaved?: (value: ScheduleDetail) => void;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change(value: ScheduleColor) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await saveSchedule({ color: value }, id);
      onSaved?.(result);
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ContextMenuSlot disabled={disabled}>
      <ScheduleColorPicker
        value={color}
        disabled={busy || disabled}
        onChange={(value) => void change(value)}
      />
      {error && <ErrorBox error={error} />}
    </ContextMenuSlot>
  );
}
