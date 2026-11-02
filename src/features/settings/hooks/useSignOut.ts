import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { createBacklogCache, type BacklogCache } from '@/features/backlog/services/backlogCache';
import { confirmAction, type ConfirmOptions } from '@/shared/utils/confirm';

export interface SignOutDeps {
  cache: BacklogCache;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const defaultDeps: SignOutDeps = { cache: createBacklogCache(), confirm: confirmAction };

export interface UseSignOutResult {
  /** Спрашивает подтверждение и выходит (FR1.4). */
  requestSignOut: () => Promise<void>;
  isSigningOut: boolean;
}

/**
 * Выход из аккаунта. Кроме сессии стираем и данные этого аккаунта на устройстве:
 * кэш бэклога в AsyncStorage и кэш react-query. Иначе на общем устройстве список игр
 * остался бы лежать после выхода. Отложенные игры не трогаем: это настройка подбора,
 * а не личные данные, и при повторном входе она пригодится.
 */
export const useSignOut = (deps: SignOutDeps = defaultDeps): UseSignOutResult => {
  const signOut = useAuth((state) => state.signOut);
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { cache, confirm } = deps;

  const requestSignOut = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Выйти из аккаунта?',
      message: 'Список игр на этом устройстве будет удалён. Чтобы вернуться, войдите через Steam.',
      confirmLabel: 'Выйти',
      destructive: true,
    });
    if (!confirmed) return;

    setIsSigningOut(true);
    // Сначала выходим: навигатор сразу убирает экраны с данными и они не перезапросят бэклог.
    await signOut();
    queryClient.clear();
    if (steamId !== null) {
      try {
        await cache.clear(steamId);
      } catch (error) {
        // Сессия уже удалена; не удалось стереть только кэш — его ключ привязан к steamId,
        // другому аккаунту он не покажется.
        console.warn('backlog cache clear failed', error);
      }
    }
    // Экран уже размонтирован, состояние сбрасывать не нужно.
  }, [cache, confirm, queryClient, signOut, steamId]);

  return { requestSignOut, isSigningOut };
};
