import { asNonNegativeInt } from '@/shared/utils/validation';

import { BacklogError, type BacklogSnapshot, type Game } from '../types/Game';
import { callFunction, type FunctionsClientDeps } from './functionsClient';
import { parseGameRows } from './parseGames';

export interface EnrichBatch {
  /** Игры, получившие жанры (и, если не было, обложку) в этом вызове. */
  games: Game[];
  /** Сколько игр ещё не проверено в RAWG. */
  remaining: number;
  failed?: number;
  interrupted?: boolean;
}

export interface RawgEnrichmentService {
  /** Одна партия обогащения через Edge Function rawg-enrich (ключ RAWG не на клиенте). */
  enrichBatch: (signal?: AbortSignal) => Promise<EnrichBatch>;
}

export const createRawgEnrichmentService = (deps: FunctionsClientDeps): RawgEnrichmentService => ({
  enrichBatch: async (signal) => {
    const body = await callFunction(deps, 'rawg-enrich', signal);
    const games = parseGameRows(body.games);
    const remaining = asNonNegativeInt(body.remaining);
    if (games === null || remaining === null) {
      throw new BacklogError('server', 'Неожиданный формат ответа rawg-enrich');
    }
    return {
      games,
      remaining,
      ...(body.failed !== undefined ? { failed: asNonNegativeInt(body.failed) ?? 0 } : {}),
      ...(body.interrupted === true ? { interrupted: true } : {}),
    };
  },
});

/** Подменяет в снимке игры с теми же appid обновлёнными версиями. Порядок сохраняется. */
export const mergeGames = (snapshot: BacklogSnapshot, updated: Game[]): BacklogSnapshot => {
  if (updated.length === 0) return snapshot;
  const byAppid = new Map(updated.map((game) => [game.appid, game]));
  return {
    ...snapshot,
    games: snapshot.games.map((game) => {
      const update = byAppid.get(game.appid);
      if (!update) return game;
      // A batch started before a manual correction must not undo that correction.
      if (game.genresOverride !== undefined)
        return {
          ...update,
          genresOverride: game.genresOverride,
          genres: game.genresOverride ?? update.importedGenres ?? update.genres,
        };
      return update;
    }),
  };
};

/** Защита от бесконечного цикла: 500 игр — это ~7 партий по 80. */
export const MAX_ENRICH_ROUNDS = 15;

export interface RunEnrichmentOptions {
  service: RawgEnrichmentService;
  /** Вызывается после каждой партии: сохранить игры в кэш и показать прогресс. */
  onBatch: (batch: EnrichBatch) => Promise<void> | void;
  maxRounds?: number;
  signal?: AbortSignal;
}

/**
 * Вызывает rawg-enrich, пока все игры не проверены. Останавливается, если партия
 * ничего не обновила, перестала уменьшать остаток или сообщила о сбое. Повтор
 * продолжает только необработанные игры без импорта Steam. Ошибки пробрасывает.
 * Возвращает, сколько игр осталось непроверенными.
 */
export const runEnrichment = async ({
  service,
  onBatch,
  maxRounds = MAX_ENRICH_ROUNDS,
  signal,
}: RunEnrichmentOptions): Promise<number> => {
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1)
    throw new Error('Invalid enrichment round limit');
  let remaining = Number.POSITIVE_INFINITY;
  for (let round = 0; round < maxRounds && remaining > 0; round += 1) {
    signal?.throwIfAborted();
    const batch = await service.enrichBatch(signal);
    signal?.throwIfAborted();
    await onBatch(batch);
    const previousRemaining = remaining;
    remaining = batch.remaining;
    if (
      batch.games.length === 0 ||
      batch.failed ||
      batch.interrupted ||
      remaining >= previousRemaining
    )
      break;
  }
  return Number.isFinite(remaining) ? remaining : 0;
};
