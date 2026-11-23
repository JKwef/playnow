import { readApiKey, requireEnv } from '../_shared/apiKeys.ts';
import { getRequestUser } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/http.ts';
import { isStoreGenre, isStoreRegion } from '../_shared/purchaseCatalog.ts';
import { fetchGenreOffers } from './catalog.ts';

const url = requireEnv('SUPABASE_URL');
const key = readApiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!(await getRequestUser(req, url, key))) return json(401, { error: 'unauthorized' });
  const body = await req.json().catch(() => null);
  const start = body?.start ?? 0;
  if (
    !isStoreRegion(body?.region) ||
    !isStoreGenre(body?.genre) ||
    !Number.isSafeInteger(start) ||
    start < 0
  )
    return json(400, { error: 'invalid_filter' });
  try {
    const page = await fetchGenreOffers(body.region, body.genre, start);
    return json(200, { region: body.region, checkedAt: Date.now(), ...page });
  } catch {
    return json(502, { error: 'steam_unavailable' });
  }
});
