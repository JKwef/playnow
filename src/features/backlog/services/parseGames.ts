import {
  asHttpsUrl,
  asNonEmptyString,
  asNonNegativeInt,
  asPositiveInt,
  asStringArray,
  isRecord,
} from '@/shared/utils/validation';

import type { Game } from '../types/Game';

/** Дата в ISO-строке или null (в том числе для кэша старых версий без поля). */
const asIsoDate = (value: unknown): string | null => {
  const text = asNonEmptyString(value, 64);
  return text !== null && !Number.isNaN(Date.parse(text)) ? text : null;
};

/**
 * Строка таблицы games (snake_case, как её отдаёт Edge Function) → Game.
 * Невалидные записи возвращают null и отбрасываются, а не ломают весь список.
 */
export const parseGameRow = (row: unknown): Game | null => {
  if (!isRecord(row)) return null;
  const appid = asPositiveInt(row.appid);
  const name = asNonEmptyString(row.name);
  if (appid === null || name === null) return null;
  return {
    appid,
    name,
    coverUrl: asHttpsUrl(row.cover_url),
    genres: asStringArray(row.genres).map((genre) => genre.toLowerCase()),
    playtimeMinutes: asNonNegativeInt(row.playtime) ?? 0,
    addedAt: asNonEmptyString(row.created_at, 64) ?? new Date(0).toISOString(),
    lastPlayedAt: asIsoDate(row.last_played_at),
  };
};

/** Game → тот же snake_case (для кэша: один формат на диске и в сети, один парсер). */
export const toGameRow = (game: Game): Record<string, unknown> => ({
  appid: game.appid,
  name: game.name,
  cover_url: game.coverUrl,
  genres: game.genres,
  playtime: game.playtimeMinutes,
  created_at: game.addedAt,
  last_played_at: game.lastPlayedAt,
});

export const parseGameRows = (rows: unknown): Game[] | null => {
  if (!Array.isArray(rows)) return null;
  const games: Game[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const game = parseGameRow(row);
    if (game !== null && !seen.has(game.appid)) {
      seen.add(game.appid);
      games.push(game);
    }
  }
  return games;
};
