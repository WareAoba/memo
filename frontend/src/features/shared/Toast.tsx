import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import type { ReactNode } from 'react';
import { ActionIcon } from './ActionIcon';
import { Button, ButtonLink } from './ui';
import './toast.css';

export function Toast({
  title,
  children,
  href,
  onClose,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  onClose: () => void;
}) {
  useTranslation();
  return (
    <article className="ui-toast">
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
      </div>
      <Button
        iconOnly
        variant="ghost"
        aria-label={tr('Toast.dismissNotificationForValue', { v1: title })}
        onClick={onClose}
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
