/**
 * Обогащение партии игр жанрами из RAWG. Зависимости внедряются, чтобы логику
 * (параллельность, бюджет времени, обработку сбоев) можно было проверить без сети и БД.
 */
import type { RawgMatch } from './rawg.ts';

export interface PendingGame {
  id: string;
  appid: number;
  name: string;
  coverUrl: string | null;
  genres: string[];
}

export interface GameUpdate {
  id: string;
  genres: string[];
  coverUrl: string | null;
}

/** RAWG отказал из-за ключа или лимита: продолжать партию бессмысленно. */
export class RawgFatalError extends Error {
  constructor(
    public readonly reason: 'bad_key' | 'rate_limited',
    message: string,
  ) {
    super(message);
    this.name = 'RawgFatalError';
  }
}

export interface EnrichDeps {
  /** null — RAWG не нашёл игру. Бросает при сбое сети/RAWG. */
  findMatch: (name: string) => Promise<RawgMatch | null>;
  /**
   * Рабочая обложка Steam для appid или null. Не вызывается для ручных игр
   * без настоящего appid и для обложек, которые уже не из шаблона Steam.
   */
  findSteamCover: (appid: number) => Promise<string | null>;
  /** Сохраняет жанры и помечает игру проверенной. */
  save: (update: GameUpdate) => Promise<void>;
  /** Сколько параллельных запросов к RAWG. */
  concurrency: number;
  /** После этого момента новые игры не начинаем (лимит времени Edge Function). */
  deadline: number;
  now: () => number;
}

export interface EnrichResult {
  updated: string[];
  /** Сбои сети/RAWG: игры останутся непроверенными и попадут в следующую партию. */
  failed: number;
  fatal: RawgFatalError | null;
}

/** appid из диапазона ручных игр (см. src/features/backlog/utils/manualGame.ts). */
const MANUAL_APPID_BASE = 2_000_000_000;

/**
 * Обложка (FR2.3): своя (не шаблон Steam) остаётся как есть; для игр Steam ищем рабочую
 * обложку в Steam; если её нет — берём из RAWG.
 */
export const resolveCover = async (
  game: Pick<PendingGame, 'appid' | 'coverUrl'>,
  rawgCover: string | null,
  findSteamCover: (appid: number) => Promise<string | null>,
): Promise<string | null> => {
  if (game.coverUrl !== null && !isSteamTemplateCover(game.coverUrl)) return game.coverUrl;
  if (game.appid < MANUAL_APPID_BASE) {
    const steamCover = await findSteamCover(game.appid);
    if (steamCover !== null) return steamCover;
  }
  return rawgCover;
};

const isSteamTemplateCover = (url: string): boolean =>
  /^https:\/\/cdn\.cloudflare\.steamstatic\.com\/steam\/apps\/\d+\/header\.jpg$/.test(url);

export const enrichGames = async (
  games: PendingGame[],
  deps: EnrichDeps,
): Promise<EnrichResult> => {
  const result: EnrichResult = { updated: [], failed: 0, fatal: null };
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < games.length && result.fatal === null && deps.now() < deps.deadline) {
      const game = games[next];
      next += 1;
      if (!game) return;
      try {
        const match = await deps.findMatch(game.name);
        const coverUrl = await resolveCover(game, match?.coverUrl ?? null, deps.findSteamCover);
        await deps.save({
          id: game.id,
          // Жанры, заданные вручную (FR2.6), не перетираем. Не нашли в RAWG — сохраняем [],
          // а пометка «проверено» не даст спрашивать RAWG об этой игре снова.
          genres: game.genres.length > 0 ? game.genres : (match?.genres ?? []),
          coverUrl,
        });
        result.updated.push(game.id);
      } catch (error) {
        if (error instanceof RawgFatalError) {
          result.fatal = error;
          return;
        }
        result.failed += 1;
        console.warn('rawg enrich failed for game', game.id, String(error));
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, deps.concurrency) }, worker));
  return result;
};
