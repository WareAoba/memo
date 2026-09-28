import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button, Surface } from '../shared/ui';
import { Toast, ToastRegion } from '../shared/Toast';
import { NotificationMenu } from './NotificationMenu';
import { reminderDescription } from './reminderInbox';
import { reminderKey, type InboxEntry } from './reminderInbox';

export function NotificationDemo() {
  useTranslation();
  const examples = (): InboxEntry[] =>
    (['design-reference.studyEnglish', 'ReminderSettings.reminder'] as const).map((title, i) => ({
      reminder: {
        id: `demo-${i}`,
        title: tr(title),
        scheduled_date: '2026-09-27',
        start_time: '09:00',
        time_zone: 'Asia/Tokyo',
        reminder_at: 0,
        start_at: 9999999999,
      },
      receivedAt: Date.now(),
      acknowledged: false,
    }));
  const [entries, setEntries] = useState(examples);
  const [toast, setToast] = useState(false);
  return (
    <Surface as="section" id="notification-reference">
      <h2>{tr('Notifications.title')}</h2>
      <NotificationMenu
        entries={entries}
        onAcknowledge={(keys) => {
          setEntries((previous) =>
            previous.map((e) =>
              keys.includes(reminderKey(e.reminder))
                ? { ...e, acknowledged: true, snoozeAt: undefined }
                : e,
            ),
          );
          if (keys.includes('demo-0:0')) setToast(false);
        }}
      />
      <Button
        onClick={() => {
          setEntries(examples());
          setToast(false);
        }}
      >
        {tr('Notifications.resetDemo')}
      </Button>
      <Button
        onClick={() => {
          setEntries(examples());
          setToast(true);
        }}
      >
        {tr('design-reference.previewToastNotification')}
      </Button>
      <ToastRegion>
        {toast && entries[0] && (
          <Toast
            title={entries[0].reminder.title}
            onClose={() => setToast(false)}
            onSnooze={(minutes) => {
              setToast(false);
              setEntries((previous) =>
                previous.map((e, i) =>
                  i === 0 ? { ...e, snoozeAt: Date.now() + minutes * 60000 } : e,
                ),
              );
            }}
          >
            {reminderDescription(entries[0].reminder)}
          </Toast>
        )}
      </ToastRegion>
    </Surface>
  );
}
