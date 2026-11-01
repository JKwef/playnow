import { getEnv } from '@/shared/config/env';
import { fetchWithTimeout } from '@/shared/services/http';
import { getSupabase } from '@/shared/services/supabase';

import type { FunctionsClientDeps } from './functionsClient';
import { createManualGameService, type ManualGameService } from './manualGames';
import { createRawgEnrichmentService, type RawgEnrichmentService } from './rawgApi';
import { createSteamLibraryService, type SteamLibraryService } from './steamApi';

let functionsDeps: FunctionsClientDeps | null = null;
let library: SteamLibraryService | null = null;
let enrichment: RawgEnrichmentService | null = null;

const getFunctionsDeps = (): FunctionsClientDeps => {
  if (functionsDeps === null) {
    const env = getEnv();
    functionsDeps = {
      functionsBaseUrl: `${env.supabaseUrl.replace(/\/+$/, '')}/functions/v1`,
      apiKey: env.supabaseAnonKey,
      // getSession сам обновит протухший access token по refresh token.
      getAccessToken: async () => {
        const { data } = await getSupabase().auth.getSession();
        return data.session?.access_token ?? null;
      },
      fetch: fetchWithTimeout,
    };
  }
  return functionsDeps;
};

/** Боевой сервис импорта (ленивый синглтон). */
export const getSteamLibrary = (): SteamLibraryService => {
  library ??= createSteamLibraryService(getFunctionsDeps());
  return library;
};

/** Боевой сервис жанров из RAWG (ленивый синглтон). */
export const getRawgEnrichment = (): RawgEnrichmentService => {
  enrichment ??= createRawgEnrichmentService(getFunctionsDeps());
  return enrichment;
};

let manualGames: ManualGameService | null = null;

/** Боевой сервис ручного добавления игр (ленивый синглтон). */
export const getManualGames = (): ManualGameService => {
  manualGames ??= createManualGameService({ getClient: getSupabase });
  return manualGames;
};
