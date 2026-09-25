import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useMobileMemoLayout } from './useMobileMemoLayout';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { ActionIcon } from './ActionIcon';
import { MemoPopover } from './MemoPopover';
import { MemoEditor, type MemoEditorHandle } from './MemoEditor';
import type { MemoCorner } from './memoPlacement';
import { ErrorBox } from './ErrorBox';
import { message } from './form';
import './customization.css';

type MemoButtonProps = {
  label: string;
  value: string;
  scope?: string;
  disabled?: boolean;
  load?: () => Promise<string>;
  onSave: (value: string) => Promise<string | void>;
  onOpenChange?: (open: boolean) => void;
  corner?: MemoCorner;
  draftKey?: string;
};
export function MemoButton(props: MemoButtonProps) {
  const mobile = useMobileMemoLayout();
  return mobile ? null : <DesktopMemoButton {...props} />;
}

function DesktopMemoButton({
  label,
  value,
  onSave,
  load,
  scope = '',
  disabled = false,
  onOpenChange,
  corner = 'top-right',
  draftKey,
}: MemoButtonProps) {
  useTranslation();
  const id = useId();
  const editor = useRef<MemoEditorHandle>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement>();
  const [initial, setInitial] = useState(value);
  const [memoSnapshot, setMemoSnapshot] = useState<{ source: string; text: string }>();
  const currentValue = memoSnapshot?.source === value ? memoSnapshot.text : value;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const closing = useRef(false);
  const open = useRef(false);
  const openCallback = useRef(onOpenChange);
  useEffect(() => {
    openCallback.current = onOpenChange;
  }, [onOpenChange]);
  useEffect(
    () => () => {
      generation.current++;
      if (open.current) openCallback.current?.(false);
    },
    [],
  );
  function close(restoreFocus = true) {
    generation.current++;
    open.current = false;
    setAnchor(undefined);
    onOpenChange?.(false);
    if (restoreFocus)
      requestAnimationFrame(() => {
        if (anchor?.isConnected) anchor.focus();
      });
  }
  function requestClose(restoreFocus = true) {
    if (!editor.current?.pending) {
      close(restoreFocus);
      return true;
    }
    if (!closing.current) {
      closing.current = true;
      const current = generation.current;
      void editor.current
        .flush()
        .then((ok) => {
          if (ok && current === generation.current) close(restoreFocus);
        })
        .finally(() => {
          closing.current = false;
        });
    }
    return false;
  }
  async function show(button: HTMLButtonElement) {
    const current = ++generation.current;
    setInitial(currentValue);
    setError('');
    setLoading(!!load);
    setAnchor(button);
    open.current = true;
    onOpenChange?.(true);
    if (load) {
      try {
        const text = await load();
        if (current !== generation.current) return;
        setInitial(text);
        setMemoSnapshot({ source: value, text });
      } catch (e) {
        if (current === generation.current) setError(message(e));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    }
  }
  return (
    <>
      <Button
        iconOnly
        variant="ghost"
        type="button"
        className={`memo-trigger${currentValue ? ' has-memo' : ''}`}
        aria-label={tr('MemoButton.valueMemo', { v1: label })}
        title={tr('MemoButton.valueMemo', { v1: label })}
        disabled={disabled && !anchor}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-controls={anchor ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (anchor) requestClose();
          else void show(e.currentTarget);
        }}
      >
        <ActionIcon name="memo" />
        {currentValue && <span className="memo-dot" />}
      </Button>
      {anchor &&
        createPortal(
          <MemoPopover
            anchor={anchor}
            id={id}
            label={tr('MemoButton.valueMemo', { v1: label })}
            corner={corner}
            onRequestClose={requestClose}
          >
            {loading ? (
              <p role="status">{tr('MemoButton.loadingMemo')}</p>
            ) : error ? (
              <ErrorBox error={error} retry={() => void show(anchor)} />
            ) : (
              <MemoEditor
                draftKey={draftKey}
                ref={editor}
                value={initial}
                scope={scope}
                autoFocus
                onSave={async (text) => {
                  const saved = await onSave(text);
                  setMemoSnapshot({ source: value, text: saved ?? text });
                  return saved;
                }}
              />
            )}
          </MemoPopover>,
          anchor.closest('dialog') ?? document.body,
        )}
    </>
  );
}
