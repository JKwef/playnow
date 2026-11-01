/**
 * Поиск рабочей обложки Steam. Старый шаблон .../steam/apps/<appid>/header.jpg есть
 * не у всех игр: у новых (EA SPORTS FC 27, Miscrits) Steam хранит картинку по адресу
 * с хэшем, и шаблон отдаёт 404. Настоящий адрес есть в API магазина (appdetails).
 */
export const steamTemplateCoverUrl = (appid: number): string =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

export const STEAM_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Обложки берём только с доменов Steam и только по https (SEC2/SEC3). */
export const isSteamImageUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.steamstatic.com');
  } catch {
    // Невалидный URL из ответа Steam — считаем, что обложки нет.
    return false;
  }
};

/** Достаёт header_image из ответа appdetails?appids=<appid>. */
export const parseAppDetailsHeader = (body: unknown, appid: number): string | null => {
  if (!isRecord(body)) return null;
  const entry = body[String(appid)];
  if (!isRecord(entry) || entry.success !== true || !isRecord(entry.data)) return null;
  const header = entry.data.header_image;
  return isSteamImageUrl(header) ? header : null;
};

export interface SteamCoverDeps {
  fetch: typeof fetch;
  timeoutMs: number;
}

/**
 * Рабочая обложка Steam или null. Сначала дешёвая проверка шаблона (HEAD к CDN),
 * при 404 — один запрос к appdetails. Сбои сети считаем «обложки нет»: тогда
 * подставится обложка из RAWG, а это лучше пустого места.
 */
export const findSteamCover = async (
  appid: number,
  deps: SteamCoverDeps,
): Promise<string | null> => {
  const template = steamTemplateCoverUrl(appid);
  try {
    const head = await deps.fetch(template, {
      method: 'HEAD',
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    if (head.ok) return template;
  } catch (error) {
    console.warn('steam cover HEAD failed', appid, String(error));
  }
  try {
    const params = new URLSearchParams({ appids: String(appid), filters: 'basic' });
    const response = await deps.fetch(`${STEAM_APPDETAILS_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    if (!response.ok) return null;
    return parseAppDetailsHeader(await response.json(), appid);
  } catch (error) {
    console.warn('steam appdetails failed', appid, String(error));
    return null;
  }
};
