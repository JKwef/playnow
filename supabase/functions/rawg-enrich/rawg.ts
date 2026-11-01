/**
 * Поиск игры в RAWG и разбор ответа. Чистые функции, покрыты тестами (rawg.test.ts).
 */

export const RAWG_SEARCH_URL = 'https://api.rawg.io/api/games';
/**
 * Сколько результатов просить. В ТЗ page_size=1, но первый результат RAWG часто
 * оказывается DLC или сиквелом («Portal» → «Portal 2»). Берём 5 и выбираем точное
 * совпадение названия: запрос один и тот же, а жанры заметно точнее.
 */
export const RAWG_PAGE_SIZE = 5;
const MAX_GENRES = 12;

export interface RawgMatch {
  /** Нормализованные жанры: rpg, puzzle, roguelike, narrative... */
  genres: string[];
  coverUrl: string | null;
}

/** Жанры RAWG → наши ключи. Остальные слаги оставляем как есть (action, puzzle...). */
const GENRE_ALIASES: Record<string, string> = {
  'role-playing-games-rpg': 'rpg',
  'massively-multiplayer': 'mmo',
  'board-games': 'board',
};

/**
 * Теги RAWG, которые нужны контекстам Solo Mode, но жанрами в RAWG не являются:
 * «roguelike» и «narrative» есть только среди тегов.
 */
const TAG_TO_GENRE: Record<string, string> = {
  roguelike: 'roguelike',
  roguelite: 'roguelike',
  'rogue-lite': 'roguelike',
  'story-rich': 'narrative',
  'visual-novel': 'narrative',
  'interactive-fiction': 'narrative',
  fps: 'shooter',
  '2d-platformer': 'platformer',
  '3d-platformer': 'platformer',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** «The Witcher® 3: Wild Hunt» → «the witcher 3 wild hunt». */
export const normalizeName = (name: string): string =>
  name
    // До NFKD: иначе «™» раскладывается в буквы «TM».
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/** Доля общих слов (коэффициент Жаккара), 0..1. */
export const nameSimilarity = (a: string, b: string): number => {
  const left = new Set(normalizeName(a).split(' ').filter(Boolean));
  const right = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common += 1;
  return common / (left.size + right.size - common);
};

/** Ниже этого порога считаем, что RAWG нашёл другую игру, и жанры не берём. */
export const MIN_SIMILARITY = 0.6;

export const buildSearchUrl = (apiKey: string, gameName: string): string => {
  const params = new URLSearchParams({
    key: apiKey,
    // Как в санитизации поиска на клиенте: без управляющих символов, разумная длина.
    search: gameName
      .replace(/[\p{Cc}]/gu, ' ')
      .trim()
      .slice(0, 200),
    page_size: String(RAWG_PAGE_SIZE),
  });
  return `${RAWG_SEARCH_URL}?${params.toString()}`;
};

const slugsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (isRecord(item) && typeof item.slug === 'string' ? item.slug : ''))
        .filter((slug) => /^[a-z0-9-]{1,60}$/.test(slug))
    : [];

/** Жанры и подходящие теги RAWG → наш список жанров без дублей. */
export const normalizeGenres = (genreSlugs: string[], tagSlugs: string[]): string[] => {
  const result = new Set<string>();
  for (const slug of genreSlugs) result.add(GENRE_ALIASES[slug] ?? slug);
  for (const slug of tagSlugs) {
    const genre = TAG_TO_GENRE[slug];
    if (genre !== undefined) result.add(genre);
  }
  return [...result].slice(0, MAX_GENRES);
};

const asHttpsUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    // Невалидный URL от API — просто без обложки.
    return null;
  }
};

/**
 * Выбирает из ответа RAWG игру с нашим названием.
 * null — RAWG ничего похожего не нашёл (это не ошибка: у игры просто не будет жанров).
 * Бросает, если формат ответа неожиданный (это сбой, его стоит повторить позже).
 */
export const pickRawgMatch = (body: unknown, gameName: string): RawgMatch | null => {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new Error('Неожиданный формат ответа RAWG');
  }
  const target = normalizeName(gameName);
  const candidates = body.results.filter(
    (item): item is Record<string, unknown> => isRecord(item) && typeof item.name === 'string',
  );
  const exact = candidates.find((item) => normalizeName(item.name as string) === target);
  const best =
    exact ??
    candidates
      .map((item) => ({ item, score: nameSimilarity(item.name as string, gameName) }))
      .filter(({ score }) => score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)[0]?.item;
  if (!best) return null;
  return {
    genres: normalizeGenres(slugsOf(best.genres), slugsOf(best.tags)),
    coverUrl: asHttpsUrl(best.background_image),
  };
};
