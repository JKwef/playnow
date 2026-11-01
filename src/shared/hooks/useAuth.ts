import { create } from 'zustand';

/**
 * unknown   — ещё не проверили сохранённую сессию (старт приложения);
 * signedOut — сессии нет, показываем вход;
 * signedIn  — есть steamId.
 */
export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  steamId: string | null;
  signIn: (steamId: string) => void;
  signOut: () => void;
}

/**
 * Глобальный стейт авторизации (Zustand).
 * ЗАГЛУШКА ЭТАПА 2: только память, стартует как signedOut.
 * На этапе 4 добавятся восстановление сессии из SecureStore и реальный вход через Steam OpenID.
 */
export const useAuth = create<AuthState>()((set) => ({
  status: 'signedOut',
  steamId: null,
  signIn: (steamId) => set({ status: 'signedIn', steamId }),
  signOut: () => set({ status: 'signedOut', steamId: null }),
}));
