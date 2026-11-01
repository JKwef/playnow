/**
 * Утилиты для query-строк. Не используем URL/URLSearchParams:
 * в React Native их реализация исторически неполная (нет get() и т.п.).
 */

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    // Битая percent-последовательность: отдаём как есть, а не роняем разбор всего URL.
    return value;
  }
};

/** Разбирает query (и fragment) URL в объект. При повторе ключа побеждает первое значение. */
export const parseQueryParams = (url: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const parts = [
    queryStart === -1
      ? ''
      : url.slice(queryStart + 1, hashStart > queryStart ? hashStart : undefined),
    hashStart === -1 ? '' : url.slice(hashStart + 1),
  ];
  for (const part of parts) {
    for (const pair of part.split('&')) {
      if (pair === '') continue;
      const eq = pair.indexOf('=');
      const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
      const value = eq === -1 ? '' : safeDecode(pair.slice(eq + 1));
      if (!(key in result)) result[key] = value;
    }
  }
  return result;
};

/** Собирает query-строку (без ведущего '?'). */
export const buildQuery = (params: Record<string, string>): string =>
  Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
