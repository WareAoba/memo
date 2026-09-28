import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface } from '../shared/ui';
import { MemoEditor } from '../shared/MemoEditor';
import { useEffect, useState } from 'react';
import { getWork, saveWork } from '../../api/works';
import type { Work } from '../../api/works';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { WorkEditor } from './WorkEditor';
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
      </Surface>
      {error && <ErrorBox error={error} />}
    </>
  );
}
