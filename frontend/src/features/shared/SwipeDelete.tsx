import { useRef, useState, type ReactNode } from 'react';
import { tr } from '../../i18n';
import { IconButton } from './IconButton';
import { ErrorBox } from './ErrorBox';
import { message } from './form';

export function DeleteButton({
  label,
  onDelete,
  disabled = false,
}: {
  label: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  return (
    <>
      <IconButton
        icon="trash"
        variant="danger"
        disabled={disabled || busy}
        onClick={async (event) => {
          event.stopPropagation();
          if (lock.current || !window.confirm(tr('Delete.confirm', { name: label }))) return;
          lock.current = true;
          setBusy(true);
          setError('');
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
      {error && <ErrorBox error={error} />}
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
