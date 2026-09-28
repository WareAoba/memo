import { useTranslation } from 'react-i18next';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '../../i18n';
import { IconButton } from './IconButton';
import { ErrorBox } from './ErrorBox';
import { message } from './form';

export function DeleteButton({
  label,
  onDelete,
  variant = 'danger',
  disabled = false,
}: {
  variant?: 'danger' | 'ghost';
  label: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}) {
  useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorHost, setErrorHost] = useState<HTMLElement | null>(null);
  const lock = useRef(false);
  return (
    <>
      <IconButton
        data-context-action="trash"
        icon="trash"
        variant={variant}
        disabled={disabled || busy}
        onClick={async (event) => {
          event.stopPropagation();
          if (lock.current || !window.confirm(tr('Delete.confirm', { name: label }))) return;
          lock.current = true;
          setBusy(true);
          setError('');
          setErrorHost(event.currentTarget.closest<HTMLElement>('[data-context-content]'));
          try {
            await onDelete();
          } catch (e) {
            setError(message(e));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {tr('Delete.item', { name: label })}
      </IconButton>
      {error &&
        (errorHost ? (
          createPortal(<ErrorBox error={error} />, errorHost)
        ) : (
          <ErrorBox error={error} />
        ))}
    </>
  );
}

export function SwipeDelete({
  children,
  label,
  onDelete,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return (
    <div
      className="swipe-delete"
      data-open={open}
      onPointerDown={(event) => {
        if (event.pointerType !== 'touch' || disabled) return;
        event.stopPropagation();
        moved.current = false;
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (!start.current) return;
        event.stopPropagation();
        const dx = event.clientX - start.current.x,
          dy = event.clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          moved.current = true;
          setOpen(dx < 0);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClickCapture={(event) => {
        if (moved.current) {
          event.preventDefault();
          event.stopPropagation();
          moved.current = false;
        }
      }}
    >
      <div className="swipe-delete-content">{children}</div>
      {open && (
        <div className="swipe-delete-reveal">
          <DeleteButton label={label} onDelete={onDelete} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
