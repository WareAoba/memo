import { observeAnchoredPopover } from '../shared/anchoredPopover';
import { usePopupState } from '../shared/usePopupExit';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { DisclosureIcon, Input, Button, MenuSurface, MenuOption } from '../shared/ui';
import { useId, useLayoutEffect, useRef, useState } from 'react';

export function DetailKindInput({
  label = tr('PresetItemsEditor.type'),
  value,
  names,
  onChange,
}: {
  label?: string;
  value: string;
  names: string[];
  onChange: (value: string) => void;
}) {
  useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen, toggle] = usePopupState(popup);
  const [manual, setManual] = useState(false);
  const [active, setActive] = useState(-1);
  const choices = ['', ...names];
  useLayoutEffect(() => {
    if (manual) input.current?.focus();
  }, [manual]);
  useLayoutEffect(() => {
    if (!open || !popup.current || !input.current) return;
    const menu = popup.current;
    const stopPositioning = observeAnchoredPopover(menu, input.current.parentElement!, {
      maxHeight: 180,
      gap: 5,
    });
    return () => {
      stopPositioning?.();
    };
  }, [open, names.length]);
  function choose(name: string) {
    setManual(name === '');
    if (name !== '') onChange(name);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="detail-kind"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          setActive(-1);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="detail-kind-control">
        <Input
          id={id}
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={id + '-options'}
          aria-autocomplete={manual ? 'list' : 'none'}
          readOnly={!manual}
          aria-activedescendant={open && active >= 0 ? id + '-option-' + active : undefined}
          autoComplete="off"
          maxLength={100}
          placeholder=""
          value={value}
          onClick={() => !manual && toggle()}
          onChange={(e) => {
            if (!manual) return;
            onChange(e.target.value);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                e.key === 'ArrowDown' ? Math.min(i + 1, choices.length - 1) : Math.max(i - 1, 0),
              );
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              if (active >= 0) choose(choices[active]!);
              else setOpen(false);
            } else if (!manual && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setOpen(true);
            } else if (e.key === 'Escape' && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <Button
          iconOnly
          variant="ghost"
          type="button"
          className="detail-kind-toggle"
          aria-label={tr('DetailKindInput.existingValueList', { v1: label })}
          aria-expanded={open}
          aria-controls={id + '-options'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            input.current?.focus();
            toggle();
            setActive(-1);
          }}
        >
          <DisclosureIcon />
        </Button>
      </div>
      {open && (
        <MenuSurface
          ref={popup}
          popover="manual"
          className="detail-kind-options"
          id={id + '-options'}
          role="listbox"
          aria-label={tr('DetailKindInput.existingValue', { v1: label })}
        >
          {choices.map((name, index) => (
            <MenuOption
              type="button"
              role="option"
              tabIndex={-1}
              id={id + '-option-' + index}
              key={name}
              aria-selected={value === name}
              data-active={active === index}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(name)}
            >
              {name || tr('DetailKindInput.enterManually')}
            </MenuOption>
          ))}
          {names.length === 0 && (
            <p className="hint">{tr('DetailKindInput.youCanEnterANewValueName', { v1: label })}</p>
          )}
        </MenuSurface>
      )}
    </div>
  );
}
