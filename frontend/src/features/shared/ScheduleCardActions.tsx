import { ScheduleContextColor } from '../schedules/ScheduleContextColor';
import type { ScheduleColor } from '../../api/scheduleColors';
import type { ScheduleDetail } from '../../api/schedules';
import { DeleteButton } from './SwipeDelete';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { MemoButton } from './MemoButton';
import { useMobileMemoLayout } from './useMobileMemoLayout';
import { Button, ButtonLink } from './ui';
import { openScheduleSticky } from '../sticky/stickyState';

export function ScheduleCardActions({
  id,
  onDelete,
  color,
  onColorSaved,
  mobileEdit = false,
  ...memo
}: ComponentProps<typeof MemoButton> & {
  id: string;
  mobileEdit?: boolean;
  onDelete?: () => Promise<void>;
  color?: ScheduleColor;
  onColorSaved?: (value: ScheduleDetail) => void;
}) {
  useTranslation();
  const mobile = useMobileMemoLayout();
  const actions = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = actions.current;
    const card = element?.closest<HTMLElement>('.schedule-card');
    if (!element || !card) return;
    const measure = () =>
      card.style.setProperty('--schedule-actions-width', element.offsetWidth + 24 + 'px');
    measure();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      card.style.removeProperty('--schedule-actions-width');
    };
  }, [mobile]);

  return (
    <div
      ref={actions}
      hidden={mobile && !mobileEdit}
      data-mobile-edit={mobileEdit || undefined}
      className="schedule-hover-actions"
    >
      <ScheduleContextColor id={id} color={color} disabled={memo.disabled} onSaved={onColorSaved} />
      <Button
        data-context-action="sticky"
        disabled={memo.disabled}
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation();
          openScheduleSticky(id, memo.label);
        }}
      >
        {tr('Sticky.show')}
      </Button>
      {onDelete && <DeleteButton label={memo.label} disabled={memo.disabled} onDelete={onDelete} />}
      <MemoButton {...memo} draftKey={'schedule:' + id} />
      <ButtonLink
        data-context-action="edit"
        data-context-memo={mobile || undefined}
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
