import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveTrack } from '../../api/tracks';
import { tr } from '../../i18n';
import { Button, Input } from '../shared/ui';
import { DropdownSelect } from '../shared/DropdownSelect';
import { PresetModal, ModalActions } from '../shared/PresetModal';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import type { TrackControls } from './trackContext';

export function TrackSelector({ track, tracks, select, updated }: TrackControls) {
  useTranslation();
  const [edit, setEdit] = useState<'create' | 'rename'>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="track-selector" title={track.name}>
      <DropdownSelect
        label={tr('Tracks.switch')}
        hideLabel
        menuMinWidth={260}
        value={track.id}
        options={[
          ...tracks.items.map((item) => ({ value: item.id, label: item.name })),
          ...(tracks.items.length < tracks.limit
            ? [{ value: 'create', label: tr('Tracks.create') }]
            : []),
          { value: 'rename', label: tr('Tracks.rename') },
        ]}
        onChange={(value) => {
          if (value === 'create' || value === 'rename') {
            setEdit(value);
            setName(value === 'rename' ? track.name : '');
            setError('');
          } else void select(value);
        }}
      />
      {edit && (
        <PresetModal
          label={tr(edit === 'create' ? 'Tracks.create' : 'Tracks.rename')}
          onClose={() => {
            if (!busy) setEdit(undefined);
          }}
        >
          <form
            id="track-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const item = await saveTrack(name, edit === 'rename' ? track.id : undefined);
                updated(item);
                setEdit(undefined);
              } catch (reason) {
                setError(message(reason));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {tr('Tracks.name')}
              <Input
                autoFocus
                required
                maxLength={80}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <p>{tr('Tracks.count', { count: tracks.items.length, limit: tracks.limit })}</p>
            {error && <ErrorBox error={error} />}
            <ModalActions>
              <Button
                type="submit"
                form="track-form"
                variant="primary"
                disabled={busy || !name.trim()}
              >
                {tr('Tracks.save')}
              </Button>
            </ModalActions>
          </form>
        </PresetModal>
      )}
    </div>
  );
}
