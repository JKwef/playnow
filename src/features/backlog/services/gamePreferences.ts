import type { AppSupabaseClient } from '@/shared/services/supabase';
import { isRecord } from '@/shared/utils/validation';

import { BacklogError } from '../types/Game';
import {
  PROGRESS_STATUSES,
  type GamePreference,
  type GamePreferences,
  type PreferencePatch,
} from '../types/GamePreference';

export const parsePreference = (row: unknown): [number, GamePreference] | null => {
  if (
    !isRecord(row) ||
    !Number.isSafeInteger(row.appid) ||
    Number(row.appid) <= 0 ||
    !(PROGRESS_STATUSES as readonly unknown[]).includes(row.progress_status) ||
    typeof row.excluded !== 'boolean'
  )
    return null;
  return [
    Number(row.appid),
    {
      progressStatus: row.progress_status as GamePreference['progressStatus'],
      excluded: row.excluded,
    },
  ];
};

export interface GamePreferencesService {
  fetch: (steamId: string, signal?: AbortSignal) => Promise<GamePreferences>;
  save: (steamId: string, appid: number, patch: PreferencePatch) => Promise<GamePreference>;
}

export const createGamePreferencesService = (
  getClient: () => AppSupabaseClient,
): GamePreferencesService => {
  const getSession = async (steamId: string) => {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session || session.user.app_metadata.steam_id !== steamId)
      throw new BacklogError('unauthorized', 'Account changed');
    return { client, session };
  };
  return {
    fetch: async (steamId, signal) => {
      signal?.throwIfAborted();
      const { client, session } = await getSession(steamId);
      const preferences = new Map<number, GamePreference>();
      let after = 0;
      for (;;) {
        signal?.throwIfAborted();
        const query = client
          .from('game_preferences')
          .select('appid, progress_status, excluded')
          .eq('user_id', session.user.id)
          .gt('appid', after)
          .order('appid')
          .limit(500);
        const { data, error } = await (signal ? query.abortSignal(signal) : query);
        if (error || !data) throw new BacklogError('server', 'Preferences unavailable');
        if (data.length === 0) return preferences;
        for (const row of data) {
          const parsed = parsePreference(row);
          if (!parsed || parsed[0] <= after)
            throw new BacklogError('server', 'Invalid preferences page');
          preferences.set(...parsed);
          after = parsed[0];
        }
      }
    },
    save: async (steamId, appid, patch) => {
      if (
        !Number.isSafeInteger(appid) ||
        appid <= 0 ||
        (patch.progressStatus !== undefined &&
          !(PROGRESS_STATUSES as readonly unknown[]).includes(patch.progressStatus)) ||
        (patch.excluded !== undefined && typeof patch.excluded !== 'boolean') ||
        (patch.progressStatus === undefined && patch.excluded === undefined)
      )
        throw new BacklogError('server', 'Invalid preference');
      const { client, session } = await getSession(steamId);
      const { data, error } = await client.rpc('set_game_preference', {
        target_appid: appid,
        expected_user_id: session.user.id,
        ...(patch.progressStatus !== undefined ? { new_status: patch.progressStatus } : {}),
        ...(patch.excluded !== undefined ? { new_excluded: patch.excluded } : {}),
      });
      if (error || !data || data.length !== 1)
        throw new BacklogError('server', 'Preference not saved');
      const parsed = parsePreference(data[0]);
      if (!parsed || parsed[0] !== appid)
        throw new BacklogError('server', 'Invalid preference response');
      return parsed[1];
    },
  };
};
