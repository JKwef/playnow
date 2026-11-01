import { isManualAppId } from '@/features/backlog/utils/manualGame';

export type LaunchErrorCode =
  /** Нет приложения, которое умеет steam:// (FR5.2). */
  | 'steam_not_installed'
  /** Игра добавлена вручную без appid Steam: запускать нечего. */
  | 'manual_game';

export class LaunchError extends Error {
  constructor(
    public readonly code: LaunchErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LaunchError';
  }
}

/** Минимум от expo-linking: в тестах подменяется. */
export interface LinkingLike {
  openURL: (url: string) => Promise<unknown>;
}

export interface SteamLauncher {
  /** Открывает steam://run/<appid> (FR5.1). Бросает LaunchError. */
  launch: (appid: number) => Promise<void>;
}

export const steamRunUrl = (appid: number): string => `steam://run/${appid}`;

/**
 * Запуск игры через deep link Steam (FR5). Сначала не спрашиваем canOpenURL:
 * на Android 11+ он без объявленных в манифесте <queries> отвечает false даже при
 * установленном Steam (а в Expo Go манифест не наш). openURL сам отклоняет промис,
 * если ссылку некому открыть, — это и есть «Steam не установлен» на iOS и Android (FR5.3).
 */
export const createSteamLauncher = (linking: LinkingLike): SteamLauncher => ({
  launch: async (appid) => {
    if (!Number.isSafeInteger(appid) || appid <= 0 || isManualAppId(appid)) {
      throw new LaunchError('manual_game', `appid ${appid} не из Steam`);
    }
    try {
      await linking.openURL(steamRunUrl(appid));
    } catch (error) {
      throw new LaunchError('steam_not_installed', 'Не удалось открыть steam://', {
        cause: error,
      });
    }
  },
});

export const LAUNCH_ERROR_MESSAGES: Record<LaunchErrorCode, string> = {
  steam_not_installed: 'Steam не установлен. Установите Steam и попробуйте снова',
  manual_game:
    'Игра добавлена вручную без ссылки на Steam, поэтому запустить её из приложения нельзя',
};

/** Страница со ссылками на мобильное приложение Steam. */
export const STEAM_INSTALL_URL = 'https://store.steampowered.com/mobile';
