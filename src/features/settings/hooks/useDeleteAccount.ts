import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { createBacklogCache, type BacklogCache } from '@/features/backlog/services/backlogCache';
import { confirmAction, type ConfirmOptions } from '@/shared/utils/confirm';

import { deleteAccountOnServer } from '../services/deleteAccount';

/** Текст ошибки для пользователя: без технических подробностей. */
export const DELETE_ACCOUNT_ERROR_MESSAGE =
  'Не удалось удалить аккаунт. Проверьте подключение и попробуйте ещё раз';

export interface DeleteAccountDeps {
  cache: BacklogCache;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Удаляет аккаунт на сервере. Бросает при ошибке. */
  deleteAccount: () => Promise<void>;
}

const defaultDeps: DeleteAccountDeps = {
  cache: createBacklogCache(),
  confirm: confirmAction,
  deleteAccount: deleteAccountOnServer,
};

export interface UseDeleteAccountResult {
  /** Спрашивает подтверждение и удаляет аккаунт (требование Google Play). */
  requestDeleteAccount: () => Promise<void>;
  isDeleting: boolean;
  /** Понятное сообщение, если удаление не удалось; null, пока всё в порядке. */
  errorMessage: string | null;
}

/**
 * Удаление аккаунта. Сначала подтверждение с предупреждением о необратимости, затем
 * Edge Function: она удаляет пользователя, а игры и история запусков уходят каскадом.
 * После успеха действуем как при выходе — стираем сессию и локальные данные этого
 * аккаунта (кэш бэклога в AsyncStorage и кэш react-query), чтобы на общем устройстве
 * ничего не осталось.
 */
export const useDeleteAccount = (deps: DeleteAccountDeps = defaultDeps): UseDeleteAccountResult => {
  const signOut = useAuth((state) => state.signOut);
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { cache, confirm, deleteAccount } = deps;

  const requestDeleteAccount = useCallback(async () => {
    if (isDeleting) return;
    const confirmed = await confirm({
      title: 'Удалить аккаунт?',
      message:
        'Аккаунт Quaeso и список ваших игр будут удалены навсегда. Отменить это действие нельзя.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!confirmed) return;

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAccount();
    } catch (error) {
      console.warn('delete account failed', error);
      setErrorMessage(DELETE_ACCOUNT_ERROR_MESSAGE);
      setIsDeleting(false);
      return;
    }

    // Аккаунта на сервере больше нет: выходим. Навигатор сам уберёт экраны с данными.
    await signOut();
    queryClient.clear();
    if (steamId !== null) {
      try {
        await cache.clear(steamId);
      } catch (error) {
        // Аккаунт уже удалён; не удалось стереть только локальную копию.
        console.warn('backlog cache clear after account deletion failed', error);
      }
    }
    setIsDeleting(false);
  }, [cache, confirm, deleteAccount, isDeleting, queryClient, signOut, steamId]);

  return { requestDeleteAccount, isDeleting, errorMessage };
};
