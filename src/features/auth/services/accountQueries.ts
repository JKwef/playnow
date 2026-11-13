import type { QueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { createBacklogCache } from '@/features/backlog/services/backlogCache';

/** Covers explicit logout, token revocation and account switches from Supabase. */
export const bindAccountQueries = (queryClient: QueryClient): (() => void) =>
  useAuth.subscribe((state, previous) => {
    const steamId = previous.user?.steamId;
    if (!steamId || steamId === state.user?.steamId) return;
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey.includes(steamId),
    };
    void queryClient.cancelQueries(filters);
    queryClient.removeQueries(filters);
    void createBacklogCache()
      .clear(steamId)
      .catch(() => console.warn('account cache cleanup failed'));
  });
