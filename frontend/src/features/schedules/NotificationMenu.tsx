import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { tr, locale } from '../../i18n';
import { AnchoredPopup } from '../shared/AnchoredPopup';
import { IconButton } from '../shared/IconButton';
import { Button, ButtonLink } from '../shared/ui';
import { usePopupState } from '../shared/usePopupExit';
import { reminderKey, reminderHref, reminderDescription, type InboxEntry } from './reminderInbox';
import './notifications.css';

/** Canonical notification dropdown, also mounted in the design reference. */
export function NotificationMenu({
  entries,
  onAcknowledge,
}: {
  entries: InboxEntry[];
  onAcknowledge: (keys: string[]) => void;
}) {
  useTranslation();
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen, toggle] = usePopupState(popup);
  const unread = entries.filter((e) => !e.acknowledged).reverse();
  useLayoutEffect(() => {
    if (open) popup.current?.querySelector<HTMLElement>('[data-notification-heading]')?.focus();
  }, [open]);
  return (
    <div className="notification-launcher">
      <IconButton
        ref={anchor}
        icon="notifications"
        aria-label={tr('Notifications.open', { count: unread.length })}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      />
      {unread.length > 0 && (
        <span className="notification-count" aria-hidden="true">
          {unread.length}
        </span>
      )}
      {open && (
        <AnchoredPopup
          anchor={anchor}
          popupRef={popup}
          width={360}
          label={tr('Notifications.title')}
          onClose={(restore = true) =>
            setOpen(false, () => {
              if (restore) anchor.current?.focus();
            })
          }
        >
          <div className="notification-menu">
            <div className="notification-heading">
              <strong tabIndex={-1} data-notification-heading>
                {tr('Notifications.title')}
              </strong>
              <Button
                variant="ghost"
                disabled={!unread.length}
                onClick={() => {
                  onAcknowledge(unread.map((e) => reminderKey(e.reminder)));
                  popup.current?.querySelector<HTMLElement>('[data-notification-heading]')?.focus();
                }}
              >
                {tr('Notifications.acknowledgeAll')}
              </Button>
            </div>
            {!unread.length && <p role="status">{tr('Notifications.empty')}</p>}
            <ul className="notification-list">
              {unread.map((entry) => (
                <li key={reminderKey(entry.reminder)}>
                  <strong>{entry.reminder.title}</strong>
                  <p>{reminderDescription(entry.reminder)}</p>
                  {entry.snoozeAt !== undefined && (
                    <p>
                      {tr('Notifications.scheduled', {
                        time: new Intl.DateTimeFormat(locale(), {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(entry.snoozeAt),
                      })}
                    </p>
                  )}
                  <div className="notification-actions">
                    <ButtonLink
                      variant="ghost"
                      href={reminderHref(entry.reminder)}
                      onClick={() => setOpen(false)}
                    >
                      {tr('Toast.viewSchedule')}
                    </ButtonLink>
                    <Button
                      variant="ghost"
                      aria-label={tr('Notifications.acknowledgeTitle', {
                        title: entry.reminder.title,
                      })}
                      onClick={() => {
                        onAcknowledge([reminderKey(entry.reminder)]);
                        popup.current
                          ?.querySelector<HTMLElement>('[data-notification-heading]')
                          ?.focus();
                      }}
                    >
                      {tr('Notifications.acknowledge')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </AnchoredPopup>
      )}
    </div>
  );
}
