import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionIcon } from './ActionIcon';
import { Button, MenuOption, MenuSurface } from './ui';

type Option = { value: string; label: string };

/** Select-only combobox using the same menu surface as preset detail inputs. */
export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
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
    menu.showPopover?.();
    function position() {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upwards = below < Math.min(menu.scrollHeight, 280) && above > below;
      menu.style.width = `${Math.min(rect.width, window.innerWidth - 24)}px`;
      menu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - rect.width - 12))}px`;
      menu.style.maxHeight = `${Math.max(0, Math.min(280, upwards ? above : below))}px`;
      menu.style.top = `${upwards ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4}px`;
    }
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(trigger.current);
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      menu.hidePopover?.();
    };
  }, [expanded]);
  useLayoutEffect(() => {
    if (expanded)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, active, id]);
  return (
    <div className="ui-dropdown">
      <label id={`${id}-label`} htmlFor={id}>
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
        onClick={() => (expanded ? setOpen(false) : show())}
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
        <span>{options.find((option) => option.value === value)?.label ?? value}</span>
        <ActionIcon name="down" />
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
                {option.label}
              </MenuOption>
            ))}
          </MenuSurface>,
          document.body,
        )}
    </div>
  );
}
