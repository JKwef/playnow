/**
 * Обогащение партии игр жанрами из RAWG. Зависимости внедряются, чтобы логику
 * (параллельность, бюджет времени, обработку сбоев) можно было проверить без сети и БД.
 */
import type { RawgMatch } from './rawg.ts';

export interface PendingGame {
  id: string;
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
        await deps.save({
          id: game.id,
          // Жанры, заданные вручную (FR2.6), не перетираем. Не нашли в RAWG — сохраняем [],
          // а пометка «проверено» не даст спрашивать RAWG об этой игре снова.
          genres: game.genres.length > 0 ? game.genres : (match?.genres ?? []),
          // Обложку Steam оставляем: RAWG только подставляет недостающую (FR2.3).
          coverUrl: game.coverUrl ?? match?.coverUrl ?? null,
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
