import { useState } from 'react';
import { resetData, type ResetTarget } from '../../api/settings';
import { tr } from '../../i18n';
import { Button, Input } from '../shared/ui';
import { PresetModal } from '../shared/PresetModal';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';

export function DataReset() {
  const [target, setTarget] = useState<ResetTarget | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  return (
    <div className="settings-reset-list">
      <p>{tr('Settings.resetHint')}</p>
      {(['schedules', 'works', 'tasks'] as const).map((kind) => (
        <section key={kind} className="settings-reset-row">
          <h3>{tr(`Settings.reset_${kind}`)}</h3>
          <p>{tr(`Settings.reset_${kind}_hint`)}</p>
          <Button
            variant="danger"
            onClick={() => {
              setTarget(kind);
              setConfirmation('');
              setError('');
              setDone(false);
            }}
          >
            {tr(`Settings.reset_${kind}`)}
          </Button>
        </section>
      ))}
      {done && <p role="status">{tr('Settings.resetDone')}</p>}
      {target && (
        <PresetModal
          label={tr(`Settings.reset_${target}`)}
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <h2>{tr(`Settings.reset_${target}`)}</h2>
          <p>{tr(`Settings.reset_${target}_hint`)}</p>
          <p>{tr('Settings.resetConfirmHint')}</p>
          <label>
            {tr('Settings.resetConfirmation')}
            <Input
              value={confirmation}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && <ErrorBox error={error} />}
          <div className="settings-reset-actions">
            <Button disabled={busy} onClick={() => setTarget(null)}>
              {tr('Settings.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy || confirmation !== 'RESET'}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await resetData(target);
                  setTarget(null);
                  setDone(true);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? tr('Settings.resetting') : tr('Settings.resetConfirm')}
            </Button>
          </div>
        </PresetModal>
      )}
    </div>
  );
}
