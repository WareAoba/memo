import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Input, Button } from '../shared/ui';
import { IconButton } from '../shared/IconButton';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetMemoButton } from '../shared/PresetMemoButton';
import { useEffect, useState } from 'react';
import { listWorks, type WorkFields } from '../../api/works';
import { listTaskPresets } from '../../api/taskPresets';
import type { Page } from '../../api/client';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
type Choice = { id: string; name: string } & Partial<WorkFields>;
function matchHint(work: Choice, query: string) {
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(needle);
  if (!needle || matches(work.name)) return '';
  const details: [string, string, boolean?][] = [
    [tr('design-reference.memo'), work.general_notes || ''],
    ...(work.custom_fields || []).map((f): [string, string, boolean] => [
      f.name || tr('Picker.details'),
      f.value,
      Boolean(f.name),
    ]),
    [tr('Picker.referenceCode'), work.reference_code || ''],
    [tr('design-reference.address'), work.address || ''],
    [tr('design-reference.contactPerson'), work.contact_name || ''],
    [tr('design-reference.contactDetails'), work.contact_info || ''],
    [tr('Picker.accessInstructions'), work.access_instructions || ''],
    [tr('Picker.parkingInstructions'), work.parking_info || ''],
    [tr('Picker.specialNotes'), work.special_notes || ''],
  ];
  const match = details.find(
    ([label, text, searchLabel]) => matches(text) || (searchLabel && matches(label)),
  );
  if (!match) return '';
  const [label, text] = match;
  const at = text.toLowerCase().indexOf(needle);
  const start = Math.max(0, at - 28);
  const excerpt = text.slice(start, start + 100);
  return `${label}: ${start ? '…' : ''}${excerpt}${start + 100 < text.length ? '…' : ''}`;
}
export function Picker({
  kind,
  onPick,
  disabled = false,
}: {
  kind: 'work' | 'task';
  onPick: (v: Choice) => void;
  disabled?: boolean;
}) {
  useTranslation();
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page<Choice>>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const searching = kind !== 'work' || Boolean(q.trim());
  useEffect(() => {
    if (!searching) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      (kind === 'work'
        ? listWorks(q.trim(), false, offset, c.signal)
        : listTaskPresets(q, false, offset, c.signal)
      )
        .then((v) => {
          if (!c.signal.aborted) setPage(v);
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(message(e));
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [kind, q, offset, attempt, searching]);
  function search(next: string, start: number) {
    setQ(next);
    setOffset(start);
    setPage(undefined);
    setError('');
  }
  return (
    <fieldset disabled={disabled} className="work-task-editor">
      <legend className="sr-only">
        {kind === 'work' ? tr('Picker.selectWork') : tr('Picker.addTask')}
      </legend>
      <label>
        <span className="sr-only">
          {kind === 'work' ? tr('Picker.searchWorks') : tr('Picker.searchTasks')}
        </span>
        <Input
          placeholder={
            kind === 'work' ? tr('Picker.searchWorkNamesDetailsAndMemos') : tr('Picker.searchTasks')
          }
          type="search"
          value={q}
          onChange={(e) => search(e.target.value, 0)}
        />
      </label>
      {error && (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {!searching && <p className="hint">{tr('Picker.enterASearchTermToFindAWork')}</p>}
      {searching && !page && !error && <p role="status">{tr('Picker.searching')}</p>}
      {searching && page && (
        <>
          <ul className="work-task-list">
            {page.items.map((v) => (
              <li key={v.id} className="picker-result memo-preview">
                <Button
                  variant="option"
                  className="picker-choice"
                  type="button"
                  onClick={() => onPick(v)}
                  aria-label={tr('Picker.selectValue', { v1: v.name })}
                >
                  <span>
                    <strong>{v.name}</strong>
                    {kind === 'work' && matchHint(v, q) && (
                      <small className="picker-match">{matchHint(v, q)}</small>
                    )}
                  </span>
                  <ActionIcon name={kind === 'work' ? 'right' : 'plus'} />
                </Button>
                <PresetMemoButton kind={kind} id={v.id} name={v.name} notes={v.general_notes} />
              </li>
            ))}
          </ul>
          {!page.total && <p>{tr('Picker.noResultsCreateAPresetFirstInPresetSettings')}</p>}
          {(page.total > 20 || offset > 0) && (
            <div className="work-task-actions">
              <IconButton
                icon="left"
                type="button"
                disabled={!offset}
                onClick={() => search(q, offset - 20)}
              >
                {tr('Picker.previous')}
              </IconButton>
              <span>{tr('Picker.totalValue', { v1: page.total })}</span>
              <IconButton
                icon="right"
                type="button"
                disabled={offset + 20 >= page.total}
                onClick={() => search(q, offset + 20)}
              >
                {tr('Picker.next')}
              </IconButton>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
