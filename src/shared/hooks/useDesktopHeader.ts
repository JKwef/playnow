import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const query = '(min-width: 768px) and (pointer: fine)';
const media = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined;

function subscribe(update: () => void) {
  const preference = media();
  preference?.addEventListener('change', update);
  return () => preference?.removeEventListener('change', update);
}

export function useDesktopHeader() {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
}
