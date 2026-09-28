import { observeAnchoredPopover } from './anchoredPopover';
import { usePopupState } from './usePopupExit';
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DisclosureIcon, Button, MenuOption, MenuSurface } from './ui';

type Option = { value: string; label: string; decoration?: ReactNode };

/** Select-only combobox using the same menu surface as preset detail inputs. */
export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hideLabel = false,
  className,
  menuMinWidth = 0,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
  menuMinWidth?: number;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen, toggle] = usePopupState(popup);
  const [active, setActive] = useState(0);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const expanded = open && !disabled;
  function show() {
    setActive(selected);
    search.current.text = '';
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!expanded || !popup.current || !trigger.current) return;
    const menu = popup.current;
    const stopPositioning = observeAnchoredPopover(menu, trigger.current, {
      minWidth: menuMinWidth,
      maxHeight: 280,
    });
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      stopPositioning?.();
    };
  }, [expanded, setOpen, menuMinWidth]);
  useLayoutEffect(() => {
    if (expanded)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, active, id]);
  return (
    <div className={`ui-dropdown ${className ?? ''}`}>
      <label className={hideLabel ? 'sr-only' : undefined} id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <Button
        ref={trigger}
        id={id}
        variant="plain"
        className="ui-input ui-dropdown-trigger"
        role="combobox"
        value={value}
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-options` : undefined}
        aria-activedescendant={expanded ? `${id}-option-${active}` : undefined}
        disabled={disabled}
        onClick={() => (expanded ? toggle() : show())}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          const key = event.key;
          if (key === 'Escape' && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            if (expanded) choose(active);
            else show();
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
            event.preventDefault();
            if (!expanded) show();
            const index = expanded ? active : selected;
            setActive(
              key === 'Home'
                ? 0
                : key === 'End'
                  ? options.length - 1
                  : Math.max(
                      0,
                      Math.min(options.length - 1, index + (key === 'ArrowDown' ? 1 : -1)),
                    ),
            );
          } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (!expanded) show();
            const now = Date.now();
            const text =
              (now - search.current.time < 700 ? search.current.text : '') +
              key.toLocaleLowerCase();
            search.current = { text, time: now };
            const index = options.findIndex((option) =>
              option.label.toLocaleLowerCase().startsWith(text),
            );
            if (index >= 0) setActive(index);
          }
        }}
      >
        <span className="ui-option-label">
          <span aria-hidden="true">
            {options.find((option) => option.value === value)?.decoration}
          </span>
          {options.find((option) => option.value === value)?.label ?? value}
        </span>
        <DisclosureIcon />
      </Button>
      {expanded &&
        createPortal(
          <MenuSurface
            ref={popup}
            popover="manual"
            className="ui-dropdown-menu"
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
          >
            {options.map((option, index) => (
              <MenuOption
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={option.value === value}
                data-active={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span className="ui-option-label">
                  <span aria-hidden="true">{option.decoration}</span>
                  {option.label}
                </span>
              </MenuOption>
            ))}
          </MenuSurface>,
          document.body,
        )}
    </div>
  );
}
