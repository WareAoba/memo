import { observeAnchoredPopover } from '../shared/anchoredPopover';
import { usePopupState } from '../shared/usePopupExit';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import { listTaskPresets } from '../../api/taskPresets';
import { Button, Input, MenuSurface } from '../shared/ui';
import { ErrorBox } from '../shared/ErrorBox';
import { message } from '../shared/form';

export type TaskChoice = { id: string; name: string };

export function TaskNameInput({
  value,
  onChange,
  onCommit,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (choice: TaskChoice) => void;
  onCommit?: (choice: TaskChoice) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  useTranslation();
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = usePopupState(popup);
  const [results, setResults] = useState<TaskChoice[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!open || !value.trim() || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void listTaskPresets(value.trim(), false, 0, controller.signal)
        .then((page) => {
          if (!controller.signal.aborted) setResults(page.items);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(message(e));
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open, disabled]);
  useLayoutEffect(() => {
    if (!open || !results.length || !popup.current || !input.current) return;
    return observeAnchoredPopover(popup.current, input.current, { maxHeight: 280 });
  }, [open, results.length]);
  useLayoutEffect(() => {
    if (open && active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, id]);
  function select(choice: TaskChoice) {
    onChange(choice);
    setOpen(false);
    onCommit?.(choice);
  }
  return (
    <div className="task-name-input">
      <Input
        ref={input}
        role="combobox"
        aria-label={tr('Picker.taskName')}
        placeholder={tr('Picker.taskName')}
        aria-autocomplete="list"
        aria-expanded={open && results.length > 0}
        aria-controls={open && results.length ? id : undefined}
        aria-activedescendant={
          open && active >= 0 && results[active] ? `${id}-${active}` : undefined
        }
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={200}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setResults([]);
          setActive(-1);
          setError('');
          setOpen(true);
          onChange({ id: 'name:' + event.target.value.trim(), name: event.target.value });
        }}
        onBlur={() => {
          setOpen(false);
          if (value.trim()) onCommit?.({ id: 'name:' + value.trim(), name: value.trim() });
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              Math.max(
                0,
                Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
              ),
            );
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (open && results[active]) select(results[active]);
            else if (value.trim()) select({ id: 'name:' + value.trim(), name: value.trim() });
          }
        }}
      />
      {open && results.length > 0 && (
        <MenuSurface
          popover="manual"
          ref={popup}
          id={id}
          role="listbox"
          className="task-name-options"
        >
          {results.map((choice, index) => (
            <Button
              key={choice.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              variant="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(choice)}
            >
              {choice.name}
            </Button>
          ))}
        </MenuSurface>
      )}
      {error && <ErrorBox error={error} />}
    </div>
  );
}
