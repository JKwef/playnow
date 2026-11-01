/** Игра из бэклога (FR2.2). */
export interface Game {
  appid: number;
  name: string;
  /** https-ссылка на обложку или null, если её нет. */
  coverUrl: string | null;
  /** Жанры в нижнем регистре (rpg, puzzle...). Заполняются из RAWG на этапе 6. */
  genres: string[];
  /** Время в игре в минутах (playtime_forever). */
  playtimeMinutes: number;
  /** Когда игра появилась в бэклоге (ISO). Нужна для сортировки «по дате добавления». */
  addedAt: string;
}

export type BacklogErrorCode =
  'network' | 'private_profile' | 'unauthorized' | 'steam_unavailable' | 'server';

export class BacklogError extends Error {
  constructor(
    public readonly code: BacklogErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'BacklogError';
  }
}

export interface BacklogSnapshot {
  games: Game[];
  /** Когда список получен из Steam (ISO). */
  updatedAt: string;
}
