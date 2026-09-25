import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { Button } from './ui';
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
  const exitAnimation = useRef<Animation | null>(null);
  const closeCallback = useRef(onClose);
  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      exitAnimation.current?.cancel();
      dialog.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  function requestClose() {
    const dialog = ref.current;
    if (!dialog || exitAnimation.current) return;
    const motion = document.documentElement.dataset.motion;
    if (
      !dialog.animate ||
      motion === 'none' ||
      motion === 'reduced' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      closeCallback.current();
      return;
    }
    dialog.dataset.closing = 'true';
    const style = getComputedStyle(dialog);
    const animation = dialog.animate(
      [
        { opacity: style.opacity, transform: style.transform },
        { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
      ],
      {
        duration: parseFloat(style.getPropertyValue('--motion-exit')) || 260,
        easing: style.getPropertyValue('--ease-exit').trim() || 'ease-in-out',
        fill: 'forwards',
      },
    );
    exitAnimation.current = animation;
    void animation.finished.then(
      () => {
        exitAnimation.current = null;
        delete dialog.dataset.closing;
        onClose();
      },
      () => {
        exitAnimation.current = null;
      },
    );
  }
  return (
    <dialog
      ref={ref}
      className={`preset-modal preset-modal-${variant}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
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
            requestClose();
        }
      }}
    >
      <header className="modal-header">
        <strong>{label}</strong>
        <Button
          iconOnly
          variant="ghost"
          className="modal-close"
          onClick={requestClose}
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
