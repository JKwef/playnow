import { isManualAppId } from '@/features/backlog/utils/manualGame';

export type LaunchErrorCode =
  /** Система не смогла открыть ссылку; причина не устанавливается. */
  | 'open_failed'
  /** У игры нет Steam appid для внешней ссылки. */
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

/** Минимальный контракт открытия ссылки; в тестах подменяется. */
export interface LinkingLike {
  openURL: (url: string) => Promise<unknown>;
}

export interface SteamLauncher {
  /** Передаёт ссылку системе с учётом устройства. Бросает LaunchError. */
  launch: (appid: number, target?: 'mobile' | 'desktop') => Promise<void>;
}

export const steamRunUrl = (appid: number): string => `steam://run/${appid}`;
export const steamStoreUrl = (appid: number): string =>
  `https://store.steampowered.com/app/${appid}/`;
export const isDesktopBrowser = (userAgent: string): boolean =>
  /Windows NT|Macintosh|X11|CrOS/.test(userAgent) && !/Mobile|Android|iPhone|iPad/.test(userAgent);

/**
 * Mobile opens the store page; desktop hands a link to the local Steam client.
 * Resolution means only that the system accepted the URL, never proof of gameplay.
 */
export const createSteamLauncher = (linking: LinkingLike): SteamLauncher => ({
  launch: async (appid, target = 'desktop') => {
    if (!Number.isSafeInteger(appid) || appid <= 0 || isManualAppId(appid)) {
      throw new LaunchError('manual_game', `appid ${appid} не из Steam`);
    }
    try {
      await linking.openURL(target === 'mobile' ? steamStoreUrl(appid) : steamRunUrl(appid));
    } catch (error) {
      throw new LaunchError('open_failed', 'Не удалось открыть внешнюю ссылку', {
        cause: error,
      });
    }
  },
});

export const LAUNCH_ERROR_MESSAGES: Record<LaunchErrorCode, string> = {
  open_failed: 'Не удалось открыть ссылку. Попробуйте страницу Steam или скопируйте ссылку.',
  manual_game: 'Игра добавлена вручную без ссылки на Steam, поэтому открыть её в Steam нельзя',
};
