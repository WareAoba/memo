import { DeleteButton } from './SwipeDelete';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { type ComponentProps } from 'react';
import { MemoButton } from './MemoButton';
import { useMobileMemoLayout } from './useMobileMemoLayout';
import { ButtonLink } from './ui';

export function ScheduleCardActions({
  id,
  onDelete,
  ...memo
}: ComponentProps<typeof MemoButton> & { id: string; onDelete?: () => Promise<void> }) {
  useTranslation();
  const mobile = useMobileMemoLayout();
  if (mobile) return null;
  return (
    <div className="schedule-hover-actions">
      {onDelete && <DeleteButton label={memo.label} disabled={memo.disabled} onDelete={onDelete} />}
      <MemoButton {...memo} draftKey={'schedule:' + id} />
      <ButtonLink
        variant="ghost"
        href={`#/schedules/${id}/edit`}
        aria-label={tr('ScheduleEditor.editSchedule')}
        title={tr('ScheduleEditor.editSchedule')}
        onClick={(e) => {
          e.stopPropagation();
          if (memo.disabled) e.preventDefault();
        }}
        aria-disabled={memo.disabled || undefined}
      >
        {tr('App.edit')}
      </ButtonLink>
    </div>
  );
}
