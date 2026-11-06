import { newSeed, seededRandom } from '@/shared/utils/random';

/** Первые значения mulberry32, посчитанные независимо от реализации. */
const SEED_HALF = [
  0.4290980885270983, 0.12713524978607893, 0.3852774982806295, 0.39639189024455845,
  0.11962746665813029,
];
const SEED_ONE = [
  0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489,
];
const SEED_ZERO = [
  0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
  0.46732782293111086,
];

const take = (random: () => number, count: number): number[] =>
  Array.from({ length: count }, () => random());

describe('seededRandom', () => {
  it('воспроизводит последовательность mulberry32 для зерна 0.5', () => {
    expect(take(seededRandom(0.5), SEED_HALF.length)).toEqual(SEED_HALF);
  });

  it('воспроизводит последовательность mulberry32 для зерна 1', () => {
    expect(take(seededRandom(1), SEED_ONE.length)).toEqual(SEED_ONE);
  });

  it('воспроизводит последовательность mulberry32 для зерна 0', () => {
    expect(take(seededRandom(0), SEED_ZERO.length)).toEqual(SEED_ZERO);
  });

  it('два генератора с одним зерном дают одинаковые числа', () => {
    const first = seededRandom(0.42);
    const second = seededRandom(0.42);
    expect(take(first, 50)).toEqual(take(second, 50));
  });

  it('разные зёрна дают разные последовательности', () => {
    expect(take(seededRandom(0.1), 5)).not.toEqual(take(seededRandom(0.2), 5));
  });

  it('все значения лежат в [0, 1)', () => {
    const values = take(seededRandom(0.777), 500);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('детерминирован и для отрицательного зерна', () => {
    expect(take(seededRandom(-0.25), 5)).toEqual(take(seededRandom(-0.25), 5));
  });

  it('не повторяет одно и то же значение подряд', () => {
    const values = take(seededRandom(0.5), 20);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});

describe('newSeed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('возвращает значение Math.random', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
    expect(newSeed()).toBe(0.42);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('пробрасывает граничные значения источника', () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9999999999);
    expect(newSeed()).toBe(0);
    expect(newSeed()).toBe(0.9999999999);
  });
});
