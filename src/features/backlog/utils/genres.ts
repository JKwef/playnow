/**
 * Подписи жанров для интерфейса. В данных жанры хранятся ключами (rpg, puzzle...):
 * так их проще сопоставлять с контекстами Solo Mode, а перевод живёт только здесь.
 */
const GENRE_LABELS: Record<string, string> = {
  action: 'Экшен',
  adventure: 'Приключения',
  arcade: 'Аркады',
  board: 'Настольные',
  card: 'Карточные',
  casual: 'Казуальные',
  educational: 'Обучающие',
  family: 'Семейные',
  fighting: 'Файтинги',
  indie: 'Инди',
  mmo: 'MMO',
  narrative: 'Сюжетные',
  platformer: 'Платформеры',
  puzzle: 'Головоломки',
  racing: 'Гонки',
  roguelike: 'Рогалики',
  rpg: 'RPG',
  shooter: 'Шутеры',
  simulation: 'Симуляторы',
  sports: 'Спорт',
  strategy: 'Стратегии',
};

/** Жанры, которые можно выбрать при ручном добавлении игры (их понимает Solo Mode). */
export const SELECTABLE_GENRES = [
  'action',
  'adventure',
  'arcade',
  'casual',
  'narrative',
  'platformer',
  'puzzle',
  'roguelike',
  'rpg',
  'shooter',
  'simulation',
  'strategy',
] as const;

export const genreLabel = (genre: string): string => {
  const label = GENRE_LABELS[genre];
  if (label !== undefined) return label;
  // Незнакомый ключ из RAWG («massively-multiplayer»): делаем читаемым, а не прячем.
  const text = genre.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
