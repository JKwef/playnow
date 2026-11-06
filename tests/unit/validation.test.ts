import {
  asHttpsUrl,
  asNonEmptyString,
  asNonNegativeInt,
  asPositiveInt,
  asStringArray,
  isRecord,
  sanitizeSearchQuery,
} from '@/shared/utils/validation';

describe('isRecord', () => {
  it('считает записями обычные объекты', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord({ nested: { ok: true } })).toBe(true);
  });

  it('не считает записями массивы, null и примитивы', () => {
    const values: unknown[] = [null, undefined, 0, '', 'text', [], [1, 2], () => undefined, true];
    for (const value of values) {
      expect(isRecord(value)).toBe(false);
    }
  });
});

describe('asNonEmptyString', () => {
  it('обрезает пробелы по краям', () => {
    expect(asNonEmptyString('  привет  ')).toBe('привет');
    expect(asNonEmptyString('\n\tтекст\t\n')).toBe('текст');
  });

  it('возвращает null для пустых строк, не-строк и null/undefined', () => {
    const values: unknown[] = ['', '   ', '\n\t', null, undefined, 42, true, [], {}];
    for (const value of values) {
      expect(asNonEmptyString(value)).toBeNull();
    }
  });

  it('ограничивает длину после trim', () => {
    expect(asNonEmptyString('  abcdef  ', 3)).toBe('abc');
  });

  it('для нулевого лимита возвращает пустую строку, а не null (граничное поведение)', () => {
    expect(asNonEmptyString('abcdef', 0)).toBe('');
  });

  it('по умолчанию ограничивает строку 500 символами', () => {
    const result = asNonEmptyString('x'.repeat(600));
    expect(result).not.toBeNull();
    expect(result).toHaveLength(500);
  });
});

describe('asNonNegativeInt', () => {
  it('принимает ноль и положительные числа', () => {
    expect(asNonNegativeInt(0)).toBe(0);
    expect(asNonNegativeInt(1)).toBe(1);
    expect(asNonNegativeInt(1e6)).toBe(1e6);
  });

  it('отбрасывает дробную часть вниз', () => {
    expect(asNonNegativeInt(5.9)).toBe(5);
    expect(asNonNegativeInt(0.1)).toBe(0);
  });

  it('возвращает null для отрицательных, бесконечностей и не-чисел', () => {
    const values: unknown[] = [
      -1,
      -0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      '5',
      null,
      undefined,
      {},
      [],
    ];
    for (const value of values) {
      expect(asNonNegativeInt(value)).toBeNull();
    }
  });
});

describe('asPositiveInt', () => {
  it('принимает положительные целые', () => {
    expect(asPositiveInt(1)).toBe(1);
    expect(asPositiveInt(42)).toBe(42);
    expect(asPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('возвращает null для нуля, отрицательных, дробных и небезопасных чисел', () => {
    const values: unknown[] = [
      0,
      -1,
      2.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '7',
      null,
      undefined,
    ];
    for (const value of values) {
      expect(asPositiveInt(value)).toBeNull();
    }
  });
});

describe('asStringArray', () => {
  it('выбрасывает нестроковые элементы и пустые строки', () => {
    const input: unknown[] = ['rpg', '', '  ', 42, null, undefined, 'action', '  puzzle  '];
    expect(asStringArray(input)).toEqual(['rpg', 'action', 'puzzle']);
  });

  it('возвращает пустой массив для не-массива', () => {
    const values: unknown[] = [null, undefined, 'rpg', 42, { 0: 'rpg' }];
    for (const value of values) {
      expect(asStringArray(value)).toEqual([]);
    }
  });

  it('ограничивает количество элементов и длину строки', () => {
    expect(asStringArray(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    const longItem = 'x'.repeat(150);
    expect(asStringArray([longItem])[0]).toHaveLength(100);
  });
});

describe('asHttpsUrl', () => {
  it('принимает только https-ссылки', () => {
    expect(asHttpsUrl('https://example.com/cover.png')).toBe('https://example.com/cover.png');
    expect(asHttpsUrl('  https://example.com/cover.png  ')).toBe('https://example.com/cover.png');
  });

  it('отклоняет http, прочие схемы и не-строки', () => {
    const values: unknown[] = [
      'http://example.com/cover.png',
      'ftp://example.com/cover.png',
      '//example.com/cover.png',
      'example.com',
      '',
      null,
      undefined,
      42,
    ];
    for (const value of values) {
      expect(asHttpsUrl(value)).toBeNull();
    }
  });

  it('обрезает ссылку до 2000 символов', () => {
    const longUrl = `https://example.com/${'a'.repeat(2500)}`;
    const result = asHttpsUrl(longUrl);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2000);
    expect(result?.startsWith('https://')).toBe(true);
  });
});

describe('sanitizeSearchQuery', () => {
  it('схлопывает пробелы и обрезает края', () => {
    expect(sanitizeSearchQuery('  the   witcher  ')).toBe('the witcher');
    expect(sanitizeSearchQuery('a\n\tb')).toBe('a b');
    expect(sanitizeSearchQuery('   ')).toBe('');
  });

  it('удаляет управляющие символы', () => {
    expect(sanitizeSearchQuery('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeSearchQuery('a\u007Fb')).toBe('ab');
    expect(sanitizeSearchQuery('a\u001Fb')).toBe('ab');
  });

  it('ограничивает длину, по умолчанию 100 символами', () => {
    expect(sanitizeSearchQuery('a'.repeat(150))).toHaveLength(100);
    expect(sanitizeSearchQuery('abcdef', 3)).toBe('abc');
    expect(sanitizeSearchQuery('abcdef', 0)).toBe('');
  });

  it('не трогает обычный текст и эмодзи', () => {
    expect(sanitizeSearchQuery('Хадес 2: Рогалик')).toBe('Хадес 2: Рогалик');
    expect(sanitizeSearchQuery('🎮 игра')).toBe('🎮 игра');
  });
});
