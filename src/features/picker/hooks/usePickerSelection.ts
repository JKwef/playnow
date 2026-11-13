import { useEffect } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';

import { createPickerSelectionStore, DEFAULT_PICKER_SELECTION } from '../services/pickerSelection';
import type { ContextId, PickerMode } from '../types';

const store = createPickerSelectionStore();
useAuth.subscribe((state, previous) => {
  if (state.user?.steamId !== previous.user?.steamId) store.getState().reset();
});

export const usePickerSelection = () => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const revision = accountRevision(steamId ?? '');
  const state = store();
  useEffect(() => {
    if (steamId) void store.getState().load(steamId);
  }, [steamId, revision]);
  const active = state.account === steamId;
  return {
    selection: active ? state.selection : DEFAULT_PICKER_SELECTION,
    isReady: active && state.isReady,
    error: active ? state.error : null,
    setMode: (mode: PickerMode) => {
      if (steamId) void state.change(steamId, { mode });
    },
    setContext: (contextId: ContextId) => {
      if (steamId) void state.change(steamId, { contextId });
    },
  };
};
