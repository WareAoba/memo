import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account } from '../../api/auth';
import { tr } from '../../i18n';
import { Button, MenuSurface, MenuOption } from '../shared/ui';
import { ActionIcon } from '../shared/ActionIcon';
import './account-menu.css';

export function AccountMenu({ account, onSettings }: { account: Account; onSettings: () => void }) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [failedPicture, setFailedPicture] = useState<string>();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, [open]);
  const trigger = useRef<HTMLButtonElement>(null);
  const picture =
    account.picture?.startsWith('https://') && account.picture !== failedPicture
      ? account.picture
      : null;
  return (
    <div
      ref={container}
      className="account-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        id="account-menu-trigger"
        variant="ghost"
        className="account-trigger"
        aria-label={account.display_name}
        title={account.display_name}
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {picture ? (
            <img
              src={picture}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedPicture(picture)}
            />
          ) : (
            account.display_name.trim().slice(0, 1) || '?'
          )}
        </span>
        <span className="account-name">{account.display_name}</span>
      </Button>
      {open && (
        <MenuSurface id="account-panel" className="account-panel">
          <div className="account-details">
            <strong>{account.display_name}</strong>
            {account.email && <span>{account.email}</span>}
          </div>
          <MenuOption
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            <ActionIcon name="settings" />
            {tr('Settings.title')}
          </MenuOption>
        </MenuSurface>
      )}
    </div>
  );
}
