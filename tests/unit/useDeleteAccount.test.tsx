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
  useAuth: Object.assign(
    (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
    { getState: () => mockAuthState },
  ),
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
  clearLocalData: jest.fn(async () => undefined),
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
  mockAuthState.user = { steamId: STEAM_ID };
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
    expect(deps.deleteAccount).toHaveBeenCalledWith(STEAM_ID);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledWith(STEAM_ID);
    expect(deps.clearLocalData).toHaveBeenCalledWith(STEAM_ID);
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('ошибка очистки кэша не отменяет выход и сообщается пользователю', async () => {
    const clear = jest.fn(async () => {
      throw new Error('storage unavailable');
    });
    const deps = createDeps({ cache: createCache(clear) });
    const { result } = await renderDeleteAccount(deps);

    await act(async () => {
      await result.current.requestDeleteAccount();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toContain('локальные данные');
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

test('смена аккаунта во время подтверждения не удаляет новый аккаунт', async () => {
  const deps = createDeps({
    confirm: jest.fn(async () => {
      mockAuthState.user = { steamId: '76561197960287931' };
      return true;
    }),
  });
  const { result } = await renderDeleteAccount(deps);
  await act(async () => {
    await result.current.requestDeleteAccount();
  });
  expect(deps.deleteAccount).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('параллельные нажатия вызывают одно подтверждение и одно удаление', async () => {
  const deps = createDeps();
  const { result } = await renderDeleteAccount(deps);
  await act(async () => {
    await Promise.all([
      result.current.requestDeleteAccount(),
      result.current.requestDeleteAccount(),
    ]);
  });
  expect(deps.confirm).toHaveBeenCalledTimes(1);
  expect(deps.deleteAccount).toHaveBeenCalledTimes(1);
});

test('новый аккаунт не выходит, если ответ удаления старого пришёл позже', async () => {
  const deps = createDeps({
    deleteAccount: jest.fn(async () => {
      mockAuthState.user = { steamId: '76561197960287931' };
    }),
  });
  const { result, clearSpy } = await renderDeleteAccount(deps);
  await act(async () => {
    await result.current.requestDeleteAccount();
  });
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(clearSpy).not.toHaveBeenCalled();
  expect(deps.clearLocalData).toHaveBeenCalledWith(STEAM_ID);
});
