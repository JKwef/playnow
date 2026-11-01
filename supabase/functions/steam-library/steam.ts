/**
 * Разбор ответа IPlayerService/GetOwnedGames. Чистые функции, покрыты тестами (steam.test.ts).
 */

export const GET_OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
/** Горизонтальная обложка магазина Steam (460x215). Есть почти у всех игр. */
export const steamCoverUrl = (appid: number): string =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

export interface OwnedGame {
  appid: number;
  name: string;
  /** Минуты, как playtime_forever в Steam. */
  playtime: number;
  coverUrl: string;
}

export type OwnedGamesResult =
  | { kind: 'ok'; games: OwnedGame[] }
  /**
   * У приватного профиля (или скрытых «Игровых деталей») Steam отвечает 200 с пустым
   * `response: {}` — без game_count. У открытого профиля без игр game_count = 0.
   */
  | { kind: 'private' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Валидирует ответ Steam. Битые записи пропускаем, а не роняем весь импорт. */
export const parseOwnedGames = (body: unknown): OwnedGamesResult => {
  if (!isRecord(body) || !isRecord(body.response)) {
    throw new Error('Неожиданный формат ответа Steam');
  }
  const { response } = body;
  if (typeof response.game_count !== 'number') {
    return { kind: 'private' };
  }
  const rawGames = Array.isArray(response.games) ? response.games : [];
  const games: OwnedGame[] = [];
  const seen = new Set<number>();
  for (const raw of rawGames) {
    if (!isRecord(raw)) continue;
    const { appid, name, playtime_forever: playtime } = raw;
    if (typeof appid !== 'number' || !Number.isSafeInteger(appid) || appid <= 0) continue;
    if (seen.has(appid)) continue;
    seen.add(appid);
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 500) : '';
    games.push({
      appid,
      // Без include_appinfo или у удалённых из магазина игр имени может не быть.
      name: trimmed.length > 0 ? trimmed : `App ${appid}`,
      playtime: typeof playtime === 'number' && playtime > 0 ? Math.floor(playtime) : 0,
      coverUrl: steamCoverUrl(appid),
    });
  }
  return { kind: 'ok', games };
};

export const buildOwnedGamesUrl = (apiKey: string, steamId: string): string => {
  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    format: 'json',
    include_appinfo: 'true',
    // Бесплатные игры, в которые пользователь заходил (Dota 2, CS2...), тоже часть бэклога.
    include_played_free_games: 'true',
  });
  return `${GET_OWNED_GAMES_URL}?${params.toString()}`;
};
