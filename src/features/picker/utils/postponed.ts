const DAY_MS = 24 * 60 * 60 * 1000;

/** «Отложена до 8 нояб. · ещё 7 дн.» */
export const formatPostponedUntil = (until: number, now: number = Date.now()): string => {
  const date = new Date(until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const days = Math.max(1, Math.ceil((until - now) / DAY_MS));
  return `Отложена до ${date} · ещё ${days} дн.`;
};
