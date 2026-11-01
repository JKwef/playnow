/**
 * Edge Function: жанры и недостающие обложки из RAWG (FR2.3).
 *
 * Steam не отдаёт жанры, поэтому после импорта клиент вызывает эту функцию, пока
 * remaining не станет 0. За один вызов обрабатывается партия игр, которые ещё не
 * проверялись в RAWG (rawg_checked_at is null): так 500 игр не упираются в лимит
 * времени функции, а уже проверенные игры не тратят квоту RAWG повторно.
 *
 * POST /rawg-enrich (с JWT пользователя)
 *   → 200 { games: GameRow[], remaining: number, failed: number }
 *        games — только обновлённые в этом вызове строки
 *   → 401 { error: 'unauthorized' }
 *   → 503 { error: 'rawg_unavailable' }  — RAWG отклонил ключ или упёрся в лимит
 *
 * Ключ RAWG живёт только здесь (SEC1).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { readApiKey, requireEnv } from '../_shared/apiKeys.ts';
import { getRequestUser } from '../_shared/auth.ts';
import { json, UPSTREAM_TIMEOUT_MS } from '../_shared/http.ts';
import { enrichGames, type PendingGame, RawgFatalError } from './enrich.ts';
import { buildSearchUrl, pickRawgMatch, type RawgMatch } from './rawg.ts';

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = readApiKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
const ANON_KEY = readApiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const RAWG_API_KEY = requireEnv('RAWG_API_KEY');

/** Игр за вызов. Сначала непройденные (playtime asc): их Solo Mode предлагает первыми. */
const BATCH_SIZE = 80;
/** Параллельных запросов к RAWG: быстро, но без риска словить лимит. */
const CONCURRENCY = 5;
/** Новые запросы не начинаем позже этого срока (лимит функции намного больше). */
const TIME_BUDGET_MS = 25_000;

const GAME_COLUMNS = 'appid, name, cover_url, genres, playtime, created_at';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const findMatch = async (name: string): Promise<RawgMatch | null> => {
  const response = await fetch(buildSearchUrl(RAWG_API_KEY, name), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403) {
    throw new RawgFatalError('bad_key', `RAWG отклонил ключ: ${response.status}`);
  }
  if (response.status === 429) {
    throw new RawgFatalError('rate_limited', 'RAWG: превышен лимит запросов');
  }
  if (!response.ok) throw new Error(`RAWG ответил ${response.status}`);
  return pickRawgMatch(await response.json(), name);
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const user = await getRequestUser(req, SUPABASE_URL, ANON_KEY);
  if (!user) return json(401, { error: 'unauthorized' });

  const pending = await admin
    .from('games')
    .select('id, name, cover_url, genres')
    .eq('user_id', user.id)
    .is('rawg_checked_at', null)
    .order('playtime', { ascending: true })
    .order('name', { ascending: true })
    .limit(BATCH_SIZE);
  if (pending.error) {
    console.error('pending games select failed', pending.error);
    return json(500, { error: 'server_error' });
  }

  const games: PendingGame[] = (pending.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    coverUrl: typeof row.cover_url === 'string' ? row.cover_url : null,
    genres: asStrings(row.genres),
  }));

  const result = await enrichGames(games, {
    findMatch,
    save: async (update) => {
      const { error } = await admin
        .from('games')
        .update({
          genres: update.genres,
          cover_url: update.coverUrl,
          rawg_checked_at: new Date().toISOString(),
        })
        .eq('id', update.id)
        .eq('user_id', user.id);
      if (error) throw new Error(`games update failed: ${error.message}`);
    },
    concurrency: CONCURRENCY,
    deadline: Date.now() + TIME_BUDGET_MS,
    now: Date.now,
  });

  if (result.fatal !== null) {
    console.error('RAWG fatal', result.fatal.reason, result.fatal.message);
  }
  // Ничего не успели обновить из-за ключа/лимита — клиенту нужно прекратить попытки.
  if (result.fatal !== null && result.updated.length === 0) {
    return json(503, { error: 'rawg_unavailable', reason: result.fatal.reason });
  }

  const remaining = await admin
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('rawg_checked_at', null);
  const updated =
    result.updated.length > 0
      ? await admin
          .from('games')
          .select(GAME_COLUMNS)
          .in('id', result.updated)
          .eq('user_id', user.id)
      : { data: [], error: null };
  if (remaining.error || updated.error) {
    console.error('rawg-enrich result select failed', remaining.error ?? updated.error);
    return json(500, { error: 'server_error' });
  }

  return json(200, {
    games: updated.data ?? [],
    remaining: remaining.count ?? 0,
    failed: result.failed,
  });
});
