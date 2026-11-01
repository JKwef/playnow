/**
 * Игры, добавленные вручную (FR2.6).
 *
 * В таблице games appid обязателен и уникален в бэклоге пользователя. Если пользователь
 * знает игру в Steam, берём её настоящий appid (тогда работает запуск через Steam).
 * Если нет, выдаём appid из диапазона, которого у Steam нет (сейчас appid Steam < 5 млн),
 * и помечаем такую игру как ручную: запускать её через steam://run нельзя.
 */
export const MANUAL_APPID_BASE = 2_000_000_000;
const MANUAL_APPID_SPAN = 2_147_483_647 - MANUAL_APPID_BASE; // верхняя граница integer в Postgres

export const isManualAppId = (appid: number): boolean => appid >= MANUAL_APPID_BASE;

/**
 * Достаёт appid из ввода пользователя: число («620») или ссылка на магазин
 * («https://store.steampowered.com/app/620/Portal_2/»). null, если не похоже ни на то, ни на другое.
 */
export const parseSteamAppId = (input: string): number | null => {
  const text = input.trim();
  if (text.length === 0 || text.length > 300) return null;
  const match = /^\d{1,9}$/.test(text) ? [text, text] : /\/app\/(\d{1,9})(?:[/?#]|$)/.exec(text);
  const appid = match?.[1] !== undefined ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isSafeInteger(appid) && appid > 0 && !isManualAppId(appid) ? appid : null;
};

/** Случайный appid для ручной игры, не совпадающий с уже занятыми. */
export const generateManualAppId = (
  taken: ReadonlySet<number>,
  random: () => number = Math.random,
): number => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const appid = MANUAL_APPID_BASE + Math.floor(random() * MANUAL_APPID_SPAN);
    if (!taken.has(appid)) return appid;
  }
  // 20 совпадений подряд на диапазоне в 147 млн практически невозможны.
  throw new Error('Не удалось подобрать свободный appid');
};
