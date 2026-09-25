import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useEffect, useState } from 'react';
import { disablePush, enablePush, readPushState, type PushState } from '../../api/push';
import { Button } from '../shared/ui';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';

export function PushSettings() {
  useTranslation();
  const [state, setState] = useState<PushState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void readPushState()
      .then((value) => {
        if (active) setState(value);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function change() {
    setBusy(true);
    setError('');
    try {
      setState(await (state?.subscribed ? disablePush() : enablePush()));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{tr('PushSettings.notificationsOnThisDevice')}</h2>
      <p>{tr('PushSettings.theServerSendsRemindersAtTheScheduledTimeFor')}</p>
      <p>{tr('PushSettings.whileTheAppIsOpenYouGetToastsWith')}</p>
      {!state && !error && <p role="status">{tr('PushSettings.checkingNotificationSettings')}</p>}
      {state && (
        <>
          <p role="status">
            {!state.supported
              ? tr('PushSettings.pushNotificationsAreNotSupportedHereOnIphoneOr')
              : !state.enabled
                ? tr('PushSettings.serverPushNotificationsAreOff')
                : state.subscribed
                  ? tr('PushSettings.pushNotificationsAreOnForThisDevice')
                  : state.permission === 'denied'
                    ? tr('PushSettings.notificationsAreBlockedByTheBrowserAllowThemIn')
                    : tr('PushSettings.pushNotificationsAreOffForThisDevice')}
          </p>
          {state.supported && state.enabled && (
            <Button
              variant={state.subscribed ? 'secondary' : 'primary'}
              disabled={busy}
              onClick={() => void change()}
            >
              {busy
                ? tr('PushSettings.processing')
                : state.subscribed
                  ? tr('PushSettings.turnOffDeviceNotifications')
                  : tr('PushSettings.turnOnDeviceNotifications')}
            </Button>
          )}
        </>
      )}
      {error && (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            void readPushState()
              .then(setState)
              .catch((e) => setError(message(e)));
          }}
        />
      )}
      <p className="hint">
        {tr('PushSettings.notificationsAreConfiguredPerDeviceNetworkPowerSavingAnd')}
      </p>
    </section>
  );
}
