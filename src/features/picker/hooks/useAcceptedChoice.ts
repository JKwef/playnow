import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { createAcceptedChoiceStore, type ChoiceInput } from '../services/acceptedChoice';

const store = createAcceptedChoiceStore();
useAuth.subscribe((state, previous) => {
  if (state.user?.steamId !== previous.user?.steamId) store.getState().reset();
});
export const useAcceptedChoice = () => {
  const account = useAuth((state) => state.user?.steamId ?? null);
  const state = store();
  useEffect(() => {
    if (account) void store.getState().load(account);
  }, [account]);
  const active = account !== null && state.account === account;
  return {
    choice: active ? state.choice : null,
    canUndo: active && state.canUndo,
    isReady: active && state.isReady,
    isSaving: active && state.isSaving,
    error: active ? state.error : null,
    accept: (input: ChoiceInput) =>
      account ? state.accept(account, input) : Promise.resolve(false),
    undo: () => (account ? state.undo(account) : Promise.resolve(false)),
    retry: () => {
      store.getState().reset();
      if (account) void store.getState().load(account);
    },
  };
};
