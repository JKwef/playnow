import { getEnv } from '@/shared/config/env';
import { fetchWithTimeout } from '@/shared/services/http';
import { getSupabase } from '@/shared/services/supabase';

import { createSteamLibraryService, type SteamLibraryService } from './steamApi';

let service: SteamLibraryService | null = null;

/** Боевой сервис импорта (ленивый синглтон). */
export const getSteamLibrary = (): SteamLibraryService => {
  if (service === null) {
    const env = getEnv();
    service = createSteamLibraryService({
      functionsBaseUrl: `${env.supabaseUrl.replace(/\/+$/, '')}/functions/v1`,
      apiKey: env.supabaseAnonKey,
      // getSession сам обновит протухший access token по refresh token.
      getAccessToken: async () => {
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
      fetch: fetchWithTimeout,
    });
  }
  return service;
};
