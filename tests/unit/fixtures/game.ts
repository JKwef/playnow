import type { Game } from '@/features/backlog/types/Game';

/** Фабрика игры для тестов: значения по умолчанию — ручная игра без жанров и запусков. */
export const makeGame = (overrides: Partial<Game> = {}): Game => ({
  appid: 1,
  name: 'Игра',
  coverUrl: null,
  genres: [],
  playtimeMinutes: 0,
  addedAt: '2026-01-01T00:00:00.000Z',
  lastPlayedAt: null,
  ...overrides,
});
