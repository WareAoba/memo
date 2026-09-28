import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listTracks, type Tracks } from '../../api/tracks';
import { hasTrackWrites, selectTrackScope } from '../../api/trackScope';
import { tr } from '../../i18n';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { flushTrackMemos } from '../shared/useMemoAutosave';
import { trackFromHash } from './workspaceRoute';
import { TrackContext } from './trackContext';

export function TrackBoundary({ accountId, children }: { accountId: string; children: ReactNode }) {
  useTranslation();
  const [data, setData] = useState<Tracks>();
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const switching = useRef(false);
  const storageKey = 'preset.track.' + accountId;
  useEffect(() => {
    let active = true;
    void listTracks()
      .then((tracks) => {
        if (!active) return;
        let remembered: string | null = null;
        try {
          remembered = localStorage.getItem(storageKey);
        } catch {
          /* Selection still works without storage. */
        }
        const requested = trackFromHash(window.location.hash);
        const selected =
          tracks.items.find((item) => item.id === (requested ?? remembered))?.id ??
          tracks.default_id;
        if (requested && !tracks.items.some((item) => item.id === requested)) {
          setError('Tracks.notFound');
          return;
        }
        selectTrackScope(accountId, selected);
        setId(selected);
        setData(tracks);
        setError('');
      })
      .catch((reason: unknown) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
  }, [accountId, storageKey, revision]);

  async function select(next: string, href?: string) {
    if (!data?.items.some((item) => item.id === next)) {
      setError('Tracks.notFound');
      return false;
    }
    if (next === id) return true;
    if (switching.current) return false;
    switching.current = true;
    try {
      if (hasTrackWrites()) {
        return false;
      }
      if (!(await flushTrackMemos())) {
        setError('Tracks.memoFailed');
        return false;
      }
      if (hasTrackWrites()) {
        return false;
      }
      const event = new Event('track-before-switch', { cancelable: true });
      if (!window.dispatchEvent(event)) return false;
      selectTrackScope(accountId, next);
      window.history.replaceState(null, '', href ?? '#/today');
      setId(next);
      setError('');
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* Selection is tab-local. */
      }
      return true;
    } finally {
      switching.current = false;
    }
  }
  const navigate = useRef(select);
  useEffect(() => {
    navigate.current = select;
  });
  useEffect(() => {
    const change = () => {
      const href = window.location.hash;
      const next = trackFromHash(href);
      if (next && next !== id)
        void navigate.current(next, href).then((changed) => {
          if (!changed && window.location.hash === href)
            window.history.replaceState(null, '', '#/today');
        });
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [id]);
  const track = data?.items.find((item) => item.id === id);
  return (
    <>
      {error && (
        <div className="track-error">
          <ErrorBox
            error={error}
            retry={() => {
              setError('');
              if (!data) {
                if (trackFromHash(window.location.hash))
                  window.history.replaceState(null, '', '#/today');
                setRevision((v) => v + 1);
              }
            }}
          />
        </div>
      )}
      {track && data ? (
        <TrackContext.Provider
          value={{
            track,
            tracks: data,
            select,
            updated: (item) =>
              setData(
                (previous) =>
                  previous && {
                    ...previous,
                    items: previous.items.some((t) => t.id === item.id)
                      ? previous.items.map((t) => (t.id === item.id ? item : t))
                      : [...previous.items, item],
                  },
              ),
          }}
        >
          {children}
        </TrackContext.Provider>
      ) : (
        !error && <p role="status">{tr('Tracks.loading')}</p>
      )}
    </>
  );
}
