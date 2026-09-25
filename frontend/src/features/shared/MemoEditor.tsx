import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useEffect, useId, useImperativeHandle, type Ref } from 'react';
import { Textarea } from './ui';
import { ErrorBox } from './ErrorBox';
import { useMemoAutosave } from './useMemoAutosave';
import './customization.css';

export type MemoEditorHandle = { flush: () => Promise<boolean>; pending: boolean };

/** Shared by desktop overlays and detail views on every screen size. */
export function MemoEditor({
  value,
  onSave,
  label = tr('design-reference.memo'),
  scope,
  disabled = false,
  ref,
  onPendingChange,
  autoFocus = false,
  draftKey,
}: {
  value: string;
  onSave: (value: string) => Promise<string | void>;
  label?: string;
  scope?: string;
  disabled?: boolean;
  ref?: Ref<MemoEditorHandle>;
  onPendingChange?: (pending: boolean) => void;
  autoFocus?: boolean;
  draftKey?: string;
}) {
  useTranslation();
  const id = useId();
  const memo = useMemoAutosave(value, onSave, disabled, draftKey);
  useImperativeHandle(ref, () => ({ flush: memo.flush, pending: memo.dirty || memo.saving }), [
    memo.flush,
    memo.dirty,
    memo.saving,
  ]);
  useEffect(() => {
    onPendingChange?.(memo.dirty || memo.saving);
  }, [onPendingChange, memo.dirty, memo.saving]);
  return (
    <section
      className="memo-editor memo-inline"
      aria-label={tr('MemoEditor.editValue', { v1: label })}
    >
      <label htmlFor={id}>{label}</label>
      {scope && (
        <p className="hint" id={id + '-scope'}>
          {scope}
        </p>
      )}
      <Textarea
        id={id}
        rows={4}
        maxLength={5000}
        value={memo.text}
        autoFocus={autoFocus}
        disabled={disabled && !memo.saving}
        aria-describedby={scope ? id + '-scope' : undefined}
        placeholder={tr('MemoButton.addNotesOrInformationToReferToLater')}
        onChange={(e) => memo.change(e.target.value)}
        onBlur={() => {
          void memo.flush();
        }}
      />
      {!memo.error && (memo.saving || memo.saved) && (
        <p className="hint memo-save-status" role="status" aria-live="polite">
          {memo.saving ? tr('Photos.saving') : tr('MemoEditor.memoSaved')}
        </p>
      )}
      {memo.error && (
        <ErrorBox
          error={memo.error}
          retry={() => {
            void memo.flush();
          }}
        />
      )}
    </section>
  );
}
