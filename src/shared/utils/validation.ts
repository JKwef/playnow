/**
 * Примитивы для валидации данных снаружи: ответы API, содержимое AsyncStorage (SEC3).
 * Без сторонних библиотек: схем немного, а лишняя зависимость в бандле не нужна.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asNonEmptyString = (value: unknown, maxLength = 500): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

export const asNonNegativeInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;

export const asPositiveInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

/** Массив строк: нестроковые элементы и пустые строки выбрасываются. */
export const asStringArray = (value: unknown, maxItems = 50): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => asNonEmptyString(item, 100))
        .filter((item): item is string => item !== null)
        .slice(0, maxItems)
    : [];

/** Только https-ссылки: картинку по http iOS всё равно не загрузит (ATS), а это ещё и SEC2. */
export const asHttpsUrl = (value: unknown): string | null => {
  const url = asNonEmptyString(value, 2000);
  return url !== null && url.startsWith('https://') ? url : null;
};

/**
 * Санитизация пользовательского ввода для поиска (SEC3): убираем управляющие символы,
 * схлопываем пробелы, ограничиваем длину.
 */
export const sanitizeSearchQuery = (input: string, maxLength = 100): string =>
  input
    // Сначала пробельные (\n, \t) превращаем в пробел, потом выкидываем прочие управляющие.
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
