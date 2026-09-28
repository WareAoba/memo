import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useRef, type ReactNode } from 'react';
import { usePopupExit } from './usePopupExit';
import { DropdownSelect } from './DropdownSelect';
import { ActionIcon } from './ActionIcon';
import { Button, ButtonLink } from './ui';
import './toast.css';

export function Toast({
  title,
  children,
  href,
  onClose,
  onSnooze,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  onClose: () => void;
  onSnooze?: (minutes: number) => void;
}) {
  useTranslation();
  const ref = useRef<HTMLElement>(null);
  const { close } = usePopupExit(ref);
  return (
    <article ref={ref} className="ui-toast">
      <span className="toast-symbol" aria-hidden="true">
        <ActionIcon name="calendar" />
      </span>
      <div className="toast-content">
        <span className="toast-label">{tr('ReminderSettings.reminder')}</span>
        <strong>{title}</strong>
        <p>{children}</p>
        {href && (
          <ButtonLink href={href} variant="ghost" onClick={onClose}>
            {tr('Toast.viewSchedule')}
            <ActionIcon name="right" />
          </ButtonLink>
        )}
        {onSnooze && (
          <DropdownSelect
            label={tr('Notifications.snooze')}
            hideLabel
            value={tr('Notifications.snooze')}
            options={[5, 10, 30, 60, 180].map((minutes) => ({
              value: String(minutes),
              label:
                minutes < 60
                  ? tr('Notifications.minutes', { count: minutes })
                  : tr('Notifications.hours', { count: minutes / 60 }),
            }))}
            onChange={(value) => close(() => onSnooze(Number(value)))}
          />
        )}
      </div>
      <Button
        iconOnly
        variant="ghost"
        aria-label={tr('Toast.dismissNotificationForValue', { v1: title })}
        onClick={() => close(onClose)}
      >
        <ActionIcon name="close" />
      </Button>
    </article>
  );
}

export function ToastRegion({ children }: { children: ReactNode }) {
  useTranslation();
  return (
    <aside
      className="toast-region"
      aria-label={tr('Toast.reminderNotifications')}
      aria-live="polite"
      aria-relevant="additions"
    >
      {children}
    </aside>
  );
}
