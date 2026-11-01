import { asNonNegativeInt } from '@/shared/utils/validation';

import { BacklogError, type BacklogSnapshot, type Game } from '../types/Game';
import { callFunction, type FunctionsClientDeps } from './functionsClient';
import { parseGameRows } from './parseGames';

export interface EnrichBatch {
  /** Игры, получившие жанры (и, если не было, обложку) в этом вызове. */
  games: Game[];
  /** Сколько игр ещё не проверено в RAWG. */
  remaining: number;
}

export interface RawgEnrichmentService {
  /** Одна партия обогащения через Edge Function rawg-enrich (ключ RAWG не на клиенте). */
  enrichBatch: () => Promise<EnrichBatch>;
}

export const createRawgEnrichmentService = (deps: FunctionsClientDeps): RawgEnrichmentService => ({
  enrichBatch: async () => {
    const body = await callFunction(deps, 'rawg-enrich');
    const games = parseGameRows(body.games);
    const remaining = asNonNegativeInt(body.remaining);
    if (games === null || remaining === null) {
      throw new BacklogError('server', 'Неожиданный формат ответа rawg-enrich');
    }
    return { games, remaining };
  },
});

/** Подменяет в снимке игры с теми же appid обновлёнными версиями. Порядок сохраняется. */
export const mergeGames = (snapshot: BacklogSnapshot, updated: Game[]): BacklogSnapshot => {
  if (updated.length === 0) return snapshot;
  const byAppid = new Map(updated.map((game) => [game.appid, game]));
  return { ...snapshot, games: snapshot.games.map((game) => byAppid.get(game.appid) ?? game) };
};

/** Защита от бесконечного цикла: 500 игр — это ~7 партий по 80. */
export const MAX_ENRICH_ROUNDS = 15;

export interface RunEnrichmentOptions {
  service: RawgEnrichmentService;
  /** Вызывается после каждой партии: сохранить игры в кэш и показать прогресс. */
  onBatch: (batch: EnrichBatch) => Promise<void> | void;
  maxRounds?: number;
}

/**
 * Вызывает rawg-enrich, пока все игры не проверены. Останавливается, если партия
 * ничего не обновила (RAWG сбоит — продолжим при следующем импорте). Ошибки пробрасывает.
 * Возвращает, сколько игр осталось непроверенными.
 */
export const runEnrichment = async ({
  service,
  onBatch,
  maxRounds = MAX_ENRICH_ROUNDS,
}: RunEnrichmentOptions): Promise<number> => {
  let remaining = Number.POSITIVE_INFINITY;
  for (let round = 0; round < maxRounds && remaining > 0; round += 1) {
    const batch = await service.enrichBatch();
    await onBatch(batch);
    remaining = batch.remaining;
    if (batch.games.length === 0) break;
  }
  return Number.isFinite(remaining) ? remaining : 0;
};
