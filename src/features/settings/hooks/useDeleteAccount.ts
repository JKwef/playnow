import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { createBacklogCache, type BacklogCache } from '@/features/backlog/services/backlogCache';
import { confirmAction, type ConfirmOptions } from '@/shared/utils/confirm';
import { clearAccountData } from '@/shared/services/accountData';
import { accountRevision } from '@/shared/services/accountScope';

import { deleteAccountOnServer } from '../services/deleteAccount';

/** Текст ошибки для пользователя: без технических подробностей. */
export const DELETE_ACCOUNT_ERROR_MESSAGE =
  'Не удалось удалить аккаунт. Проверьте подключение и попробуйте ещё раз';

export interface DeleteAccountDeps {
  cache: BacklogCache;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Удаляет аккаунт на сервере. Бросает при ошибке. */
  deleteAccount: (steamId: string) => Promise<void>;
  clearLocalData?: (steamId: string) => Promise<void>;
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
  const inFlight = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { cache, confirm, deleteAccount, clearLocalData = clearAccountData } = deps;

  const requestDeleteAccount = useCallback(async () => {
    if (inFlight.current || steamId === null) return;
    inFlight.current = true;
    const revision = accountRevision(steamId);
    try {
      const confirmed = await confirm({
        title: 'Удалить аккаунт?',
        message:
          'Аккаунт Quaeso и список ваших игр будут удалены навсегда. Отменить это действие нельзя.',
        confirmLabel: 'Удалить',
        destructive: true,
      });
      if (
        !confirmed ||
        useAuth.getState().user?.steamId !== steamId ||
        accountRevision(steamId) !== revision
      )
        return;

      setIsDeleting(true);
      setErrorMessage(null);
      try {
        await deleteAccount(steamId);
      } catch (error) {
        console.warn('delete account failed', error);
        setErrorMessage(DELETE_ACCOUNT_ERROR_MESSAGE);
        setIsDeleting(false);
        return;
      }

      // Аккаунта на сервере больше нет: выходим. Навигатор сам уберёт экраны с данными.
      const filters = {
        predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey.includes(steamId),
      };
      await queryClient.cancelQueries(filters);
      if (useAuth.getState().user?.steamId === steamId && accountRevision(steamId) === revision) {
        await signOut();
        queryClient.clear();
      } else {
        queryClient.removeQueries(filters);
      }
      if (steamId !== null) {
        try {
          await Promise.all([cache.clear(steamId), clearLocalData(steamId)]);
        } catch (error) {
          // Аккаунт уже удалён; не удалось стереть только локальную копию.
          console.warn('backlog cache clear after account deletion failed', error);
          setErrorMessage('Аккаунт удалён. Не удалось очистить локальные данные на устройстве.');
        }
      }
      setIsDeleting(false);
    } finally {
      inFlight.current = false;
    }
  }, [cache, confirm, deleteAccount, clearLocalData, queryClient, signOut, steamId]);

  return { requestDeleteAccount, isDeleting, errorMessage };
};
