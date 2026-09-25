import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button, Input } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { useEffect, useRef, useState } from 'react';
import {
  deletePhoto,
  listPhotos,
  photoUrl,
  uploadPhoto,
  type Photo,
  type PhotoTarget,
} from '../../api/photos';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { useEditorActive } from '../useEditorActive';
export function Photos({ target, locked }: { target: PhotoTarget; locked: boolean }) {
  useTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="detail-section photo-section"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary>{tr('Photos.photosOptional')}</summary>
      {opened && <PhotoPanel key={target.type + target.id} target={target} locked={locked} />}
    </details>
  );
}
function PhotoPanel({ target, locked }: { target: PhotoTarget; locked: boolean }) {
  useTranslation();
  const active = useEditorActive();
  const [items, setItems] = useState<Photo[]>();
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    listPhotos({ type: target.type, id: target.id }, c.signal)
      .then((result) => {
        if (!c.signal.aborted) setItems(result);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [target.type, target.id, attempt]);
  async function save() {
    if (!file || lock.current || locked) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const photo = await uploadPhoto(target, file);
      if (active.current) {
        setItems((current) => [...(current || []), photo]);
        setFile(undefined);
        if (input.current) input.current.value = '';
      }
    } catch (e) {
      if (active.current) setError(message(e));
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function remove(id: string) {
    if (lock.current || locked) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await deletePhoto(id);
      if (active.current) {
        setItems((current) => current?.filter((p) => p.id !== id));
        setRemoving(undefined);
      }
    } catch (e) {
      if (active.current) setError(message(e));
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <div>
      <p>{tr('Photos.addOnlyThePhotosYouNeedJpegPngWebp')}</p>
      <p className="hint">{tr('Photos.choosePhotosUpTo8192PxPerSideAnd')}</p>
      {error && (
        <ErrorBox
          error={error}
          retry={
            !items
              ? () => {
                  setError('');
                  setAttempt((n) => n + 1);
                }
              : undefined
          }
        />
      )}
      {!items && !error && <p role="status">{tr('Photos.loadingPhotos')}</p>}
      {items && (
        <>
          {!items.length && <p>{tr('Photos.noPhotosAdded')}</p>}
          <div className="photo-grid">
            {items.map((photo) => (
              <figure key={photo.id}>
                <a href={photoUrl(photo.id)} target="_blank" rel="noreferrer">
                  <img
                    loading="lazy"
                    src={photoUrl(photo.id)}
                    alt={photo.filename}
                    onError={(e) => {
                      e.currentTarget.alt = tr('Photos.valueCouldNotLoadPhoto', {
                        v1: photo.filename,
                      });
                    }}
                  />
                </a>
                <figcaption>{photo.filename}</figcaption>
                {!locked &&
                  (removing === photo.id ? (
                    <div>
                      <p>{tr('Photos.deleteThisPhoto')}</p>
                      <Button
                        iconOnly
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void remove(photo.id)}
                        aria-label={tr('Photos.confirmDeletion')}
                        title={tr('Photos.confirmDeletion')}
                      >
                        <ActionIcon name="check" />
                      </Button>
                      <Button
                        iconOnly
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRemoving(undefined)}
                        aria-label={tr('Photos.cancel')}
                        title={tr('Photos.cancel')}
                      >
                        <ActionIcon name="close" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      iconOnly
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRemoving(photo.id)}
                      aria-label={tr('Photos.deletePhoto')}
                      title={tr('Photos.deletePhoto')}
                    >
                      <ActionIcon name="trash" />
                    </Button>
                  ))}
              </figure>
            ))}
          </div>
          {!locked && (
            <div className="photo-upload">
              <label>
                {tr('Photos.photoToAdd')}
                <Input
                  ref={input}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy || items.length >= 100}
                  onChange={(e) => {
                    setFile(e.target.files?.[0]);
                    setError('');
                  }}
                />
              </label>
              <IconButton
                icon="camera"
                disabled={busy || !file || items.length >= 100}
                onClick={() => void save()}
              >
                {busy ? tr('Photos.saving') : tr('Photos.addPhoto')}
              </IconButton>
            </div>
          )}
        </>
      )}
      {locked && <p>{tr('Photos.photosInCancelledSchedulesAreReadOnly')}</p>}
    </div>
  );
}
