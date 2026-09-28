import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Move the owning feature's controls into the menu without copying their handlers. */
export function ContextMenuSlot({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = anchor.current!;
    const mount = (event: Event) => setHost((event as CustomEvent<HTMLElement | null>).detail);
    element.addEventListener('context-menu-slot', mount);
    return () => element.removeEventListener('context-menu-slot', mount);
  }, []);
  return (
    <>
      <span hidden ref={anchor} data-context-slot aria-disabled={disabled || undefined} />
      {host &&
        createPortal(<div onClick={(event) => event.stopPropagation()}>{children}</div>, host)}
    </>
  );
}
