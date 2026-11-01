import type { AppSupabaseClient } from '@/shared/services/supabase';
import { asNonEmptyString } from '@/shared/utils/validation';

import { generateManualAppId } from '../utils/manualGame';

export type ManualGameErrorCode =
  /** Игра с таким appid уже есть в бэклоге. */
  'duplicate' | 'invalid' | 'network' | 'unauthorized' | 'server';

export class ManualGameError extends Error {
  constructor(
    public readonly code: ManualGameErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ManualGameError';
  }
}

export interface NewManualGame {
  name: string;
  /** Настоящий appid Steam, если пользователь его указал. */
  steamAppId: number | null;
  genres: readonly string[];
}

export interface ManualGameService {
  /** Добавляет игру в бэклог пользователя (FR2.6). Жанры и обложку потом дотянет RAWG. */
  addGame: (game: NewManualGame, takenAppIds: ReadonlySet<number>) => Promise<void>;
}

export interface ManualGameDeps {
  getClient: () => AppSupabaseClient;
  random?: () => number;
}

const MESSAGES: Record<ManualGameErrorCode, string> = {
  duplicate: 'Эта игра уже есть в вашем списке',
  invalid: 'Введите название игры',
  network: 'Нет подключения к интернету',
  unauthorized: 'Сессия истекла. Войдите снова',
  server: 'Не удалось сохранить игру. Попробуйте позже',
};

export const manualGameErrorMessage = (error: unknown): string =>
  MESSAGES[error instanceof ManualGameError ? error.code : 'server'];

/**
 * Пишем напрямую в таблицу games: RLS разрешает пользователю вставлять только строки
 * со своим user_id, а column-level grants не дают задать служебные колонки.
 */
export const createManualGameService = (deps: ManualGameDeps): ManualGameService => ({
  addGame: async (game, takenAppIds) => {
    const name = asNonEmptyString(game.name, 500);
    if (name === null) throw new ManualGameError('invalid', 'Пустое название');
    if (game.steamAppId !== null && takenAppIds.has(game.steamAppId)) {
      throw new ManualGameError('duplicate', `appid ${game.steamAppId} уже в бэклоге`);
    }

    const client = deps.getClient();
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId === undefined) throw new ManualGameError('unauthorized', 'Нет сессии');

    const { error } = await client.from('games').insert({
      user_id: userId,
      appid: game.steamAppId ?? generateManualAppId(takenAppIds, deps.random),
      name,
      genres: [...game.genres],
    });
    if (error === null) return;

    // 23505 — нарушение уникальности (user_id, appid): игра уже есть, например, из Steam.
    if (error.code === '23505') throw new ManualGameError('duplicate', error.message);
    if (error.code === '42501' || error.code === 'PGRST301') {
      throw new ManualGameError('unauthorized', error.message);
    }
    // Сетевые сбои supabase-js отдаёт как ошибку без кода с текстом от fetch.
    if (!error.code && /network|fetch|abort/i.test(error.message)) {
      throw new ManualGameError('network', error.message);
    }
    throw new ManualGameError('server', `${error.code}: ${error.message}`);
  },
});
