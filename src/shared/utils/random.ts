/**
 * Детерминированный генератор случайных чисел (mulberry32) по зерну.
 * Подбор игры вызывается при рендере, а Math.random в рендере делает его нечистым:
 * поэтому зерно хранится в состоянии и меняется только по нажатию «Другой вариант».
 * Заодно алгоритм воспроизводим в тестах.
 */
export const seededRandom = (seed: number): (() => number) => {
  let state = Math.floor(seed * 0xffffffff) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Случайное зерно для seededRandom. */
export const newSeed = (): number => Math.random();
