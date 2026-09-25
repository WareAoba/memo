import { useSyncExternalStore } from 'react';

const query = '(max-width: 700px)';
function subscribe(update: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', update);
  return () => media?.removeEventListener('change', update);
}
const snapshot = () => window.matchMedia?.(query).matches ?? false;
export function useMobileLayout() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
