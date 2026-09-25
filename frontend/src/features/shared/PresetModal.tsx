import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button } from './/ui';
import { ActionIcon } from './ActionIcon';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
const FooterContext = createContext<HTMLDivElement | null>(null);
export function ModalActions({ children }: { children: ReactNode }) {
  const footer = useContext(FooterContext);
  return footer ? createPortal(children, footer) : children;
}
export function PresetModal({
  children,
  onClose,
  label,
  variant = 'detail',
  closeLabel = tr('PresetModal.closeDetails'),
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  variant?: 'detail' | 'schedule';
  closeLabel?: string;
}) {
  useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`preset-modal preset-modal-${variant}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="modal-header">
        <strong>{label}</strong>
        <Button
          iconOnly
          variant="ghost"
          className="modal-close"
          onClick={onClose}
          aria-label={closeLabel}
          title={tr('ScheduleEditor.close')}
        >
          <ActionIcon name="close" />
        </Button>
      </header>
      <FooterContext.Provider value={footer}>
        <div className="modal-body">{children}</div>
      </FooterContext.Provider>
      <div className="modal-footer" ref={setFooter} />
    </dialog>
  );
}
export function PresetSwitch({ kind }: { kind: 'works' | 'tasks' }) {
  useTranslation();
  return (
    <nav className="preset-switch" aria-label={tr('PresetModal.switchPresetType')}>
      <a href="#/presets/works" aria-current={kind === 'works' ? 'page' : undefined}>
        {tr('ScheduleEditor.work')}
      </a>
      <a href="#/presets/tasks" aria-current={kind === 'tasks' ? 'page' : undefined}>
        {tr('ScheduleEditor.task')}
      </a>
    </nav>
  );
}
