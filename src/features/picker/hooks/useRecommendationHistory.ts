import { useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';
import { createRecommendationHistoryStore } from '@/features/picker/services/recommendationHistory';
import type { RefusalReason } from '@/features/picker/types/refusal';

const store = createRecommendationHistoryStore();
useAuth.subscribe((state, previous) => {
  if (state.user?.steamId !== previous.user?.steamId) store.getState().reset();
});

export function useRecommendationHistory() {
  const account = useAuth((state) => state.user?.steamId ?? null);
  const revision = accountRevision(account ?? '');
  const state = store();
  useEffect(() => {
    if (account) void store.getState().load(account);
  }, [account, revision]);
  const active = account !== null && state.account === account;
  const record = useCallback(
    (input: ChoiceInput) =>
      account && accountRevision(account) === revision
        ? store.getState().record(account, input)
        : Promise.resolve(false),
    [account, revision],
  );
  return {
    entries: active ? state.entries : [],
    isReady: active && state.isReady,
    isSaving: active && state.pending > 0,
    error: active ? state.error : null,
    record,
    setRefusal: (id: string, reason: RefusalReason | null) =>
      account && accountRevision(account) === revision
        ? store.getState().setRefusal(account, id, reason)
        : Promise.resolve(false),
    retry: () =>
      account && accountRevision(account) === revision
        ? store.getState().load(account, true)
        : Promise.resolve(),
    clear: () =>
      account && accountRevision(account) === revision
        ? store.getState().clear(account)
        : Promise.resolve(false),
  };
}
