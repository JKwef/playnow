import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';
import { createInstalledGamesStore } from '@/features/backlog/services/installedGames';

const store = createInstalledGamesStore();
const EMPTY: ReadonlySet<number> = new Set();
useAuth.subscribe((state, previous) => {
  if (state.user?.steamId !== previous.user?.steamId) store.getState().reset();
});
export function useInstalledGames() {
  const account = useAuth((state) => state.user?.steamId ?? null);
  const revision = accountRevision(account ?? '');
  const state = store();
  useEffect(() => {
    if (account) void store.getState().load(account);
  }, [account, revision]);
  const active = account !== null && state.account === account;
  return {
    marked: active ? state.marked : EMPTY,
    isReady: active && state.isReady,
    isSaving: active && state.pending > 0,
    error: active ? state.error : null,
    setMarked: (appid: number, marked: boolean) =>
      account && accountRevision(account) === revision
        ? store.getState().setMarked(account, appid, marked)
        : Promise.resolve(false),
    retry: () =>
      account && accountRevision(account) === revision
        ? store.getState().load(account, true)
        : Promise.resolve(),
  };
}
