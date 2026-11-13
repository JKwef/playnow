import type { AppSupabaseClient } from '@/shared/services/supabase';

import { BacklogError, type Game } from '../types/Game';
import { SELECTABLE_GENRES } from '../utils/genres';
import { parseGameRow } from './parseGames';

export interface GenreOverridesService {
  save: (appid: number, steamId: string, genres: readonly string[] | null) => Promise<Game>;
}

export const createGenreOverridesService = (
  getClient: () => AppSupabaseClient,
): GenreOverridesService => ({
  save: async (appid, steamId, genres) => {
    const normalized = genres === null ? null : [...new Set(genres)];
    if (
      normalized !== null &&
      (normalized.length === 0 ||
        normalized.some((genre) => !(SELECTABLE_GENRES as readonly string[]).includes(genre)))
    ) {
      throw new BacklogError('server', 'Выберите хотя бы один жанр');
    }
    const client = getClient();
    const { data, error: authError } = await client.auth.getSession();
    if (authError) throw authError;
    const session = data.session;
    if (!session || session.user.app_metadata.steam_id !== steamId)
      throw new BacklogError('unauthorized', 'Account changed');
    const result = await client
      .from('games')
      .update({ genres_override: normalized })
      .eq('user_id', session.user.id)
      .eq('appid', appid)
      .select(
        'appid, name, cover_url, genres, genres_override, playtime, created_at, last_played_at, rawg_checked_at',
      )
      .maybeSingle();
    if (result.error)
      throw new BacklogError(
        /network|fetch|abort/i.test(result.error.message) ? 'network' : 'server',
        'Genre update failed',
      );
    const game = parseGameRow(result.data);
    if (!game) throw new BacklogError('server', 'Game no longer available');
    return game;
  },
});
