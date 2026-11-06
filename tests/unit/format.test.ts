import { formatDateTime, formatPlaytime } from '@/shared/utils/format';

describe('formatPlaytime', () => {
  const cases: [number, string][] = [
    [0, 'Не запускалась'],
    [-1, 'Не запускалась'],
    [-120, 'Не запускалась'],
    [Number.NaN, 'Не запускалась'],
    [Number.POSITIVE_INFINITY, 'Не запускалась'],
    [Number.NEGATIVE_INFINITY, 'Не запускалась'],
    [1, '1 мин'],
    [45, '45 мин'],
    [59, '59 мин'],
    [59.9, '59 мин'],
    [60, '1 ч'],
    [60.9, '1 ч'],
    [61, '1 ч 1 мин'],
    [125, '2 ч 5 мин'],
    [1440, '24 ч'],
    [1500, '25 ч'],
  ];

  for (const [minutes, expected] of cases) {
    it(`formatPlaytime(${minutes}) → «${expected}»`, () => {
      expect(formatPlaytime(minutes)).toBe(expected);
    });
  }

  it('округляет минуты вниз: 119.99 мин — это «1 ч 59 мин»', () => {
    expect(formatPlaytime(119.99)).toBe('1 ч 59 мин');
  });

  it('большие значения остаются корректными', () => {
    expect(formatPlaytime(6000)).toBe('100 ч');
  });
});

describe('formatDateTime', () => {
  /** «Сейчас» — 6 ноября 2026 года, чтобы проверить правило «год только для прошлых лет». */
  const now = new Date(2026, 10, 6, 12, 0, 0);

  it('для даты текущего года выводит день, короткий месяц и время без года', () => {
    const result = formatDateTime('2026-11-01T22:04:00', now);
    expect(result).toMatch(/^1\s+нояб/);
    expect(result).toContain('22:04');
    expect(result).not.toContain('2026');
  });

  it('для даты другого года добавляет год', () => {
    const result = formatDateTime('2021-03-05T18:30:00', now);
    expect(result).toContain('мар');
    expect(result).toContain('2021');
    expect(result).toContain('18:30');
  });

  it('дополняет часы и минуты нулём', () => {
    const result = formatDateTime('2026-01-02T09:05:00', now);
    expect(result).toContain('09:05');
  });

  it('сравнивает год с переданным now, а не с текущей датой', () => {
    const past = new Date(2026, 10, 6, 12, 0, 0);
    const result = formatDateTime('2025-12-31T23:59:00', past);
    expect(result).toContain('2025');
  });

  it('для пустой и невалидной даты возвращает пустую строку', () => {
    const invalid = ['', 'не дата', '2026-13-45T99:99:99', '2026-02-30T99:00:00'];
    for (const iso of invalid) {
      expect(formatDateTime(iso, now)).toBe('');
    }
  });

  it('по умолчанию использует текущую дату как now', () => {
    const current = new Date();
    const iso = new Date(current.getFullYear(), 4, 17, 9, 5, 0).toISOString();
    const result = formatDateTime(iso);
    expect(result).toContain('09:05');
    expect(result).not.toContain(String(current.getFullYear()));
  });
});
