import { useEffect, useRef } from 'react';

// A completed save must not navigate away from a newer screen.
export function useEditorActive() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const path = window.location.hash;
    const leave = () => {
      if (window.location.hash !== path) active.current = false;
    };
    window.addEventListener('hashchange', leave);
    return () => {
      active.current = false;
      window.removeEventListener('hashchange', leave);
    };
  }, []);
  return active;
}
