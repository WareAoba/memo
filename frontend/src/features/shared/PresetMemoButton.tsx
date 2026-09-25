import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { getWork, saveWork } from '../../api/works';
import { getTaskPreset, saveTaskPreset } from '../../api/taskPresets';
import { MemoButton } from './MemoButton';

export function PresetMemoButton({
  kind,
  id,
  name,
  notes = '',
  onSaved,
}: {
  kind: 'work' | 'task';
  id: string;
  name: string;
  notes?: string;
  onSaved?: (notes: string) => void;
}) {
  useTranslation();
  return (
    <MemoButton
      draftKey={kind + ':' + id}
      label={name}
      value={notes}
      scope={tr('PresetMemoButton.defaultMemoForThePresetExistingScheduleRecordsWill')}
      load={async () =>
        kind === 'work'
          ? (await getWork(id)).general_notes
          : (await getTaskPreset(id)).default_notes
      }
      onSave={async (value) => {
        const saved =
          kind === 'work'
            ? (await saveWork({ general_notes: value }, id)).general_notes
            : (await saveTaskPreset({ default_notes: value }, id)).default_notes;
        onSaved?.(saved);
        return saved;
      }}
    />
  );
}
