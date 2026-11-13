import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { createAcceptedChoiceStore, type ChoiceInput } from '../services/acceptedChoice';
import { subscribePickerChanges } from '@/features/picker/services/pickerSyncSignals';

const store = createAcceptedChoiceStore();
subscribePickerChanges((account, remote) => {
  if (
    remote &&
    store.getState().account === account &&
    useAuth.getState().user?.steamId === account
  ) {
    store.getState().reset();
    void store.getState().load(account);
  }
});
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
