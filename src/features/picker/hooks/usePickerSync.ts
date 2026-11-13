import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';
import { getSupabase } from '@/shared/services/supabase';
import { createPickerSyncStore } from '@/features/picker/services/pickerSync';
import { createPickerSyncRemote } from '@/features/picker/services/pickerSyncRemote';
import { subscribePickerChanges } from '@/features/picker/services/pickerSyncSignals';
import { blacklistKey } from '@/features/picker/hooks/useBlacklist';

const store = createPickerSyncStore(createPickerSyncRemote(getSupabase));
useAuth.subscribe((state, previous) => {
  if (state.user?.steamId !== previous.user?.steamId) store.getState().reset();
});

/** One bridge per application: no requests until synchronization is explicitly enabled. */
export function PickerSyncBridge() {
  const account = useAuth((state) => state.user?.steamId ?? null);
  const client = useQueryClient();
  useEffect(() => {
    if (!account) return;
    void store.getState().load(account);
    const sync = () => {
      if (AppState.currentState === 'active' || AppState.currentState === null)
        void store.getState().sync(account);
    };
    const interval = setInterval(sync, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const unsubscribe = subscribePickerChanges((changed, remote) => {
      if (changed !== account) return;
      if (remote) void client.invalidateQueries({ queryKey: blacklistKey(account) });
      else sync();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      unsubscribe();
    };
  }, [account, client]);
  return null;
}

export function usePickerSync() {
  const account = useAuth((state) => state.user?.steamId ?? null);
  const revision = accountRevision(account ?? '');
  const state = store();
  useEffect(() => {
    if (account) void store.getState().load(account);
  }, [account]);
  const active = account !== null && state.account === account;
  const current = () => account !== null && accountRevision(account) === revision;
  return {
    phase: active ? state.phase : 'loading',
    enabled: active && state.document?.enabled === true,
    isReady: active && state.document !== null,
    conflict: active ? state.conflict : null,
    error: active ? state.error : null,
    lastSyncedAt: active ? state.lastSyncedAt : null,
    enable: (enabled: boolean) =>
      current() ? store.getState().enable(account!, enabled) : Promise.resolve(),
    sync: () =>
      current()
        ? state.document
          ? store.getState().sync(account!)
          : store.getState().load(account!)
        : Promise.resolve(),
    resolve: (version: 'local' | 'remote') =>
      current() ? store.getState().resolve(account!, version) : Promise.resolve(),
  };
}
