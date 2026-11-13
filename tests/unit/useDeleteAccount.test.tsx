import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { BacklogCache } from '@/features/backlog/services/backlogCache';
import {
  DELETE_ACCOUNT_ERROR_MESSAGE,
  useDeleteAccount,
  type DeleteAccountDeps,
} from '@/features/settings/hooks/useDeleteAccount';

const STEAM_ID = '76561197960287930';

const mockSignOut = jest.fn(async () => undefined);
const mockAuthState = {
  status: 'signedIn',
  user: { steamId: STEAM_ID },
  signOut: mockSignOut,
};

jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock('@/features/settings/services/deleteAccount', () => ({
  deleteAccountOnServer: jest.fn(async () => undefined),
}));

// Настоящий кэш тянет AsyncStorage (нативный модуль): в тесте он не нужен, зависимости DI.
jest.mock('@/features/backlog/services/backlogCache', () => ({
  createBacklogCache: jest.fn(),
}));

const createCache = (clear = jest.fn(async () => undefined)): BacklogCache => ({
  read: jest.fn(async () => null),
  write: jest.fn(async () => undefined),
  clear,
});

const createDeps = (overrides: Partial<DeleteAccountDeps> = {}): DeleteAccountDeps => ({
  cache: createCache(),
  confirm: jest.fn(async () => true),
  deleteAccount: jest.fn(async () => undefined),
  ...overrides,
});

const renderDeleteAccount = async (deps: DeleteAccountDeps) => {
  const queryClient = new QueryClient();
  const clearSpy = jest.spyOn(queryClient, 'clear');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(() => useDeleteAccount(deps), { wrapper });
  return { queryClient, clearSpy, ...rendered };
};

beforeEach(() => {
  jest.clearAllMocks();
  // Хук предупреждает об ошибке через console.warn: в тестах этот шум не нужен.
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useDeleteAccount: подтверждение', () => {
  it('без согласия ничего не удаляет и не выходит', async () => {
    const confirm = jest.fn(async () => false);
    const deps = createDeps({ confirm });
    const { result, clearSpy } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Удалить аккаунт?', destructive: true }),
    );
    expect(deps.deleteAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });
});

describe('useDeleteAccount: успешное удаление', () => {
  it('удаляет аккаунт, выходит и стирает локальные данные', async () => {
    const clear = jest.fn(async () => undefined);
    const deps = createDeps({ cache: createCache(clear) });
    const { result, clearSpy } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });

    expect(deps.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledWith(STEAM_ID);
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('ошибка очистки кэша не отменяет выход и не показывается пользователю', async () => {
    const clear = jest.fn(async () => {
      throw new Error('storage unavailable');
    });
    const deps = createDeps({ cache: createCache(clear) });
    const { result } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toBeNull();
  });
});

describe('useDeleteAccount: ошибка удаления', () => {
  it('показывает понятный текст и не выходит из аккаунта', async () => {
    const clear = jest.fn(async () => undefined);
    const deps = createDeps({
      cache: createCache(clear),
      deleteAccount: jest.fn(async () => {
        throw new Error('Edge Function responded with 500');
      }),
    });
    const { result, clearSpy } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });

    expect(result.current.errorMessage).toBe(DELETE_ACCOUNT_ERROR_MESSAGE);
    expect(result.current.isDeleting).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('очищает прошлую ошибку при новой попытке', async () => {
    const deleteAccount = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    const deps = createDeps({ deleteAccount });
    const { result } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });
    expect(result.current.errorMessage).toBe(DELETE_ACCOUNT_ERROR_MESSAGE);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });
    expect(deleteAccount).toHaveBeenCalledTimes(2);
    expect(result.current.errorMessage).toBeNull();
  });
});
