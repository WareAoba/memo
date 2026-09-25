import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface, Button } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { MemoEditor } from '../shared/MemoEditor';
import { useEffect, useState } from 'react';
import { archiveWork, getWork, saveWork } from '../../api/works';
import type { Work } from '../../api/works';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { WorkEditor } from './WorkEditor';
import { WorkTasks } from './WorkTasks';
export function WorkDetail({ id, modal = false }: { id: string; edit?: boolean; modal?: boolean }) {
  useTranslation();
  const [value, setValue] = useState<Work>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    getWork(id, controller.signal)
      .then((e) => {
        if (active) setValue(e);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [id, attempt]);
  async function archive() {
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      if (value.archived) {
        setValue(await saveWork({ archived: false }, id));
      } else {
        await archiveWork(id);
        setValue({ ...value, archived: true });
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!value)
    return error ? (
      <ErrorBox
        error={error}
        retry={() => {
          setError('');
          setAttempt((n) => n + 1);
        }}
      />
    ) : (
      <p role="status">{tr('WorkDetail.loadingWorkDetails')}</p>
    );
  return (
    <>
      {value.archived && <p className="eyebrow">{tr('WorkDetail.archivedWork')}</p>}
      <WorkEditor
        key={revision}
        initial={value}
        id={id}
        embedded={modal}
        hideMemo
        onDone={(saved) => {
          setValue(saved);
          setRevision((v) => v + 1);
        }}
      />
      <Surface as="section" className="detail-section">
        <MemoEditor
          draftKey={'work:' + id}
          label={tr('Schedules.workMemo')}
          value={value.general_notes}
          disabled={busy}
          scope={tr('PresetMemoButton.defaultMemoForThePresetExistingScheduleRecordsWill')}
          onSave={async (general_notes) => {
            setBusy(true);
            try {
              const updated = await saveWork({ general_notes }, id);
              setValue(updated);
              return updated.general_notes;
            } finally {
              setBusy(false);
            }
          }}
        />
        <div className="tags">
          {value.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </Surface>
      {modal ? (
        <details className="optional-fields">
          <summary>{tr('WorkDetail.manageDefaultTasks')}</summary>
          <WorkTasks key={id} id={id} />
        </details>
      ) : (
        <WorkTasks key={id} id={id} />
      )}
      {error && <ErrorBox error={error} />}
      <section className="archive-section">
        <p>
          {value.archived
            ? tr('WorkDetail.thisWorkIsArchivedRestoreItToShowIt')
            : tr('WorkDetail.archivingHidesThisWorkFromTheActiveListSaved')}
        </p>
        <Button variant="ghost" disabled={busy} onClick={() => void archive()}>
          <ActionIcon name="archive" />
          {busy
            ? tr('PushSettings.processing')
            : value.archived
              ? tr('WorkDetail.restoreWork')
              : tr('WorkDetail.archiveWork')}
        </Button>
      </section>
    </>
  );
}
