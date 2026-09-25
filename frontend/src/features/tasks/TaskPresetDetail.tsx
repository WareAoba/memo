import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Surface, Button } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { MemoEditor } from '../shared/MemoEditor';
import { useEffect, useState } from 'react';
import { archiveTaskPreset, getTaskPreset, saveTaskPreset } from '../../api/taskPresets';
import type { TaskPreset } from '../../api/taskPresets';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
import { TaskPresetEditor } from './TaskPresetEditor';
export function TaskPresetDetail({
  id,
  modal = false,
}: {
  id: string;
  edit?: boolean;
  modal?: boolean;
}) {
  useTranslation();
  const [value, setValue] = useState<TaskPreset>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    getTaskPreset(id, controller.signal)
      .then((v) => {
        if (active) setValue(v);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [id, attempt]);
  async function archive() {
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      if (value.archived) setValue(await saveTaskPreset({ archived: false }, id));
      else {
        await archiveTaskPreset(id);
        setValue({ ...value, archived: true, version: value.version + 1 });
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
      <p role="status">{tr('TaskPresetDetail.loadingTaskDetails')}</p>
    );
  return (
    <>
      {value.archived && <p className="eyebrow">{tr('TaskPresetDetail.archivedTask')}</p>}
      {!modal && (
        <nav className="breadcrumb">
          <a href="#/presets/tasks">{tr('TaskPresetDetail.tasks')}</a>
          <span>{tr('App.edit')}</span>
        </nav>
      )}
      <TaskPresetEditor
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
          draftKey={'task:' + id}
          label={tr('TaskPresetDetail.defaultMemo')}
          value={value.default_notes}
          disabled={busy}
          scope={tr('PresetMemoButton.defaultMemoForThePresetExistingScheduleRecordsWill')}
          onSave={async (default_notes) => {
            setBusy(true);
            try {
              const updated = await saveTaskPreset({ default_notes }, id);
              setValue(updated);
              return updated.default_notes;
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
      {error && <ErrorBox error={error} />}
      <div className="actions">
        <Button variant="ghost" disabled={busy} onClick={archive}>
          <ActionIcon name="archive" />
          {busy
            ? tr('PushSettings.processing')
            : value.archived
              ? tr('TaskPresetDetail.restoreTask')
              : tr('TaskPresetDetail.archiveTask')}
        </Button>
      </div>
    </>
  );
}
