import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './ui';

/** Shared vertical navigation with a single moving selection surface. */
export function VerticalTabs<T extends string>({
  label,
  items,
  children,
}: {
  label: string;
  items: readonly { value: T; label: string }[];
  children: (value: T) => ReactNode;
}) {
  const id = useId();
  const [selection, setSelection] = useState({ index: 0, direction: 1 });
  const list = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const current = items[selection.index]!;
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const position = () => {
      const selected = element.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!selected || !indicator.current) return;
      indicator.current.style.height = selected.offsetHeight + 'px';
      indicator.current.style.transform = 'translateY(' + selected.offsetTop + 'px)';
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [selection.index, items]);
  function select(index: number) {
    if (index !== selection.index)
      setSelection({ index, direction: index > selection.index ? 1 : -1 });
  }
  return (
    <div className="ui-vertical-tabs">
      <div className="ui-vertical-tab-scroll">
        <div
          ref={list}
          className="ui-vertical-tab-list"
          role="tablist"
          aria-label={label}
          aria-orientation="vertical"
        >
          <span ref={indicator} className="ui-vertical-tab-indicator" aria-hidden="true" />
          {items.map((item, index) => (
            <Button
              key={item.value}
              variant="plain"
              role="tab"
              id={id + '-tab-' + item.value}
              aria-controls={id + '-panel-' + item.value}
              aria-selected={index === selection.index}
              tabIndex={index === selection.index ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowDown'
                    ? (index + 1) % items.length
                    : event.key === 'ArrowUp'
                      ? (index + items.length - 1) % items.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? items.length - 1
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                select(next);
                document.getElementById(id + '-tab-' + items[next]!.value)?.focus();
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="ui-vertical-page-viewport">
        <div
          key={current.value}
          className="ui-vertical-page"
          data-direction={selection.direction}
          role="tabpanel"
          id={id + '-panel-' + current.value}
          aria-labelledby={id + '-tab-' + current.value}
          tabIndex={0}
        >
          {children(current.value)}
        </div>
      </div>
    </div>
  );
}
