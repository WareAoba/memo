import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { PageHeader, ButtonLink, Input, Button, Surface, CardButton } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import { PresetMemoButton } from '../shared/PresetMemoButton';
import { IconButton } from '../shared/IconButton';
import { PresetModal, PresetSwitch } from '../shared/PresetModal';
import { WorkDetail } from './WorkDetail';
import { useEffect, useState } from 'react';
import { listWorks } from '../../api/works';
import type { WorkList } from '../../api/works';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';
export function WorkListView({ revision = 0 }: { revision?: number }) {
  useTranslation();
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState({ q: '', archived: false, offset: 0 });
  const [data, setData] = useState<WorkList>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    listWorks(filter.q, filter.archived, filter.offset, controller.signal, 48)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [filter, attempt, revision]);
  function update(next: typeof filter) {
    setLoading(true);
    setError('');
    setFilter(next);
  }
  return (
    <>
      {selected && (
        <PresetModal
          label={tr('WorkDetail.editWork')}
          onClose={() => {
            setSelected(undefined);
            setAttempt((v) => v + 1);
          }}
        >
          <WorkDetail id={selected} edit={false} modal />
        </PresetModal>
      )}
      <PageHeader className="page-heading">
        <div>
          <h1>{tr('WorkListView.workPresets')}</h1>
        </div>
        <div className="preset-heading-actions">
          <PresetSwitch kind="works" />
          <ButtonLink
            iconOnly
            variant="primary"
            title={tr('WorkListView.createWork')}
            aria-label={tr('WorkListView.createWork')}
            data-modal-trigger

            href="#/presets/works/new"
          >
            <ActionIcon name="plus" />
          </ButtonLink>
        </div>
      </PageHeader>
      <section aria-label={tr('Picker.searchWorks')} className="toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ ...filter, q: draft, offset: 0 });
          }}
        >
          <label className="sr-only" htmlFor="search">
            {tr('Picker.searchWorks')}
          </label>
          <Input
            id="search"
            type="search"
            maxLength={200}
            placeholder={tr('WorkListView.searchWorkNamesAndDetails')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <IconButton icon="search" type="submit">
            {tr('TaskPresetListView.search')}
          </IconButton>
        </form>
        <div className="tabs">
          <Button
            aria-pressed={!filter.archived}
            onClick={() => update({ ...filter, archived: false, offset: 0 })}
          >
            {tr('TaskPresetListView.active')}
          </Button>
          <Button
            aria-pressed={filter.archived}
            onClick={() => update({ ...filter, archived: true, offset: 0 })}
          >
            {tr('TaskPresetListView.archive')}
          </Button>
        </div>
      </section>
      {loading ? (
        <p role="status">{tr('WorkListView.loadingWorks')}</p>
      ) : error ? (
        <ErrorBox
          error={error}
          retry={() => {
            setError('');
            setLoading(true);
            setAttempt((v) => v + 1);
          }}
        />
      ) : (
        data && (
          <>
            <p className="result-count">
              {tr('TaskPresetListView.valueValueValue', {
                v1: filter.archived ? tr('WorkDetail.archivedWork') : tr('ScheduleEditor.work'),
                v2: data.total,
                v3: filter.q && tr('TaskPresetListView.resultsForValue', { v1: filter.q }),
              })}
            </p>
            {data.items.length === 0 ? (
              <Surface as="section" className="empty">
                <h2>
                  {filter.q
                    ? tr('ScheduleSearch.noResultsFound')
                    : filter.archived
                      ? tr('WorkListView.noArchivedWorks')
                      : tr('WorkListView.createYourFirstWork')}
                </h2>
                <p>
                  {filter.q
                    ? tr('WorkListView.tryADifferentWorkNameDetailTypeOrContent')
                    : filter.archived
                      ? tr('WorkListView.youCanRestoreArchivedWorksHere')
                      : tr('WorkListView.saveAWorkNameAndDescriptionThenLinkDefault')}
                </p>
              </Surface>
            ) : (
              <div className="work-list compact-presets">
                {data.items.map((item) => (
                  <div key={item.id} className="preset-preview memo-preview">
                    <CardButton
                      type="button"
                      key={item.id}
                      data-modal-trigger
                      className="work-card"
                      onClick={() => setSelected(item.id)}
                    >
                      <h2>{item.name}</h2>
                      {item.general_notes && (
                        <p className="work-description">{item.general_notes}</p>
                      )}
                      <div className="tags">
                        {item.tags.map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </CardButton>
                    <PresetMemoButton
                      kind="work"
                      id={item.id}
                      name={item.name}
                      notes={item.general_notes}
                      onSaved={(general_notes) =>
                        setData(
                          (current) =>
                            current && {
                              ...current,
                              items: current.items.map((w) =>
                                w.id === item.id ? { ...w, general_notes } : w,
                              ),
                            },
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            {(data.total > 48 || filter.offset > 0) && (
              <nav className="pagination" aria-label={tr('TaskPresetListView.listPages')}>
                <IconButton
                  icon="left"
                  disabled={filter.offset === 0}
                  onClick={() => update({ ...filter, offset: Math.max(0, filter.offset - 48) })}
                >
                  {tr('Picker.previous')}
                </IconButton>
                <span>
                  {data.total === 0 ? 0 : filter.offset + 1}–
                  {Math.min(filter.offset + 48, data.total)} / {data.total}
                </span>
                <IconButton
                  icon="right"
                  disabled={filter.offset + 48 >= data.total}
                  onClick={() => update({ ...filter, offset: filter.offset + 48 })}
                >
                  {tr('Picker.next')}
                </IconButton>
              </nav>
            )}
          </>
        )
      )}
    </>
  );
}
