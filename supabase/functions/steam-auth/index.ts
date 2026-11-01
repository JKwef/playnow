/**
 * Edge Function: вход через Steam OpenID 2.0 → сессия Supabase.
 *
 * Steam не умеет OAuth, а Supabase Auth не умеет Steam, поэтому мост делаем сами:
 *
 *   приложение ──GET /start?challenge&redirect──▶ функция ──302──▶ steamcommunity.com (логин)
 *   Steam ──302 /callback?openid.*──▶ функция: проверка подписи у Steam
 *        ──302 playnow://auth?code=…──▶ приложение
 *   приложение ──POST /exchange {code, verifier}──▶ функция: создаёт/находит пользователя,
 *        возвращает access/refresh токены Supabase
 *
 * Деплой без проверки JWT (её нет у браузера и у редиректа из Steam):
 *   npx supabase functions deploy steam-auth --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  buildSteamLoginUrl,
  isAllowedRedirect,
  isValidChallenge,
  redeemCode,
  signCode,
  SteamAuthError,
  verifySteamAssertion,
} from './openid.ts';
import { readApiKey, requireEnv } from '../_shared/apiKeys.ts';

// SUPABASE_* Supabase прокидывает в функции автоматически.
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = readApiKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS');
const ANON_KEY = readApiKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
/** Ключ подписи кодов. Отдельный секрет можно задать, но по умолчанию выводится из service role. */
const CODE_SIGNING_KEY = Deno.env.get('STEAM_AUTH_CODE_SECRET') ?? `steam-auth:${SERVICE_ROLE_KEY}`;
/** Куда разрешено возвращать пользователя. exp:// нужен для разработки в Expo Go. */
const ALLOWED_REDIRECT_PREFIXES = (Deno.env.get('ALLOWED_REDIRECT_PREFIXES') ?? 'playnow://,exp://')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter((prefix) => prefix.length > 0);
/**
 * Supabase Auth требует email. Steam его не отдаёт, поэтому делаем технический адрес
 * в зарезервированной зоне .invalid (RFC 2606): письма на него никогда не уйдут.
 */
const SYNTHETIC_EMAIL_DOMAIN = 'steam.playnow.invalid';

const FUNCTION_BASE_URL = `${SUPABASE_URL}/functions/v1/steam-auth`;
const CALLBACK_URL = `${FUNCTION_BASE_URL}/callback`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const redirectTo = (location: string): Response =>
  new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });

const withQuery = (base: string, params: Record<string, string>): string =>
  `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;

// ---------------------------------------------------------------------------

/** GET /start: валидируем вход и отправляем пользователя на страницу Steam. */
const handleStart = (url: URL): Response => {
  const challenge = url.searchParams.get('challenge');
  const redirect = url.searchParams.get('redirect');
  if (!isValidChallenge(challenge) || !isAllowedRedirect(redirect, ALLOWED_REDIRECT_PREFIXES)) {
    return json(400, { error: 'invalid_request' });
  }
  // challenge и redirect едут в return_to: Steam подписывает return_to,
  // так что на callback они приходят неподделанными.
  const returnTo = withQuery(CALLBACK_URL, { challenge, redirect });
  return redirectTo(buildSteamLoginUrl(returnTo, new URL(SUPABASE_URL).origin));
};

/** GET /callback: Steam вернул пользователя. Проверяем подпись и отдаём приложению код. */
const handleCallback = async (url: URL): Promise<Response> => {
  const challenge = url.searchParams.get('challenge');
  const redirect = url.searchParams.get('redirect');
  if (!isValidChallenge(challenge) || !isAllowedRedirect(redirect, ALLOWED_REDIRECT_PREFIXES)) {
    return json(400, { error: 'invalid_request' });
  }
  try {
    // Тот же return_to, что мы отправили в /start. Steam его подписал, verify сверит точно.
    const expectedReturnTo = withQuery(CALLBACK_URL, { challenge, redirect });
    const steamId = await verifySteamAssertion(url.searchParams, expectedReturnTo, fetch);
    const code = await signCode(steamId, challenge, CODE_SIGNING_KEY, nowSeconds());
    return redirectTo(withQuery(redirect, { code }));
  } catch (error) {
    const code = error instanceof SteamAuthError ? error.code : 'server_error';
    console.error('steam-auth callback failed', code, String(error));
    return redirectTo(withQuery(redirect, { error: code }));
  }
};

/**
 * Находит или создаёт пользователя Supabase для SteamID и выпускает ему сессию.
 * Сессию получаем штатно: admin.generateLink(magiclink) → verifyOtp. Письмо при этом
 * не отправляется, мы сразу «нажимаем» ссылку на сервере.
 */
const issueSession = async (steamId: string) => {
  const email = `${steamId}@${SYNTHETIC_EMAIL_DOMAIN}`;

  // steam_id кладём в app_metadata: его может менять только service role,
  // в отличие от user_metadata, которую пользователь правит сам.
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { provider: 'steam', steam_id: steamId },
  });
  if (created.error && created.error.code !== 'email_exists') {
    throw created.error;
  }

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const userId = link.data.user.id;

  const profile = await admin
    .from('users')
    .upsert({ id: userId, steam_id: steamId }, { onConflict: 'id' });
  if (profile.error) throw profile.error;

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: 'magiclink',
  });
  if (verified.error || !verified.data.session) {
    throw verified.error ?? new Error('verifyOtp не вернул сессию');
  }
  return verified.data.session;
};

/** POST /exchange {code, verifier}: обмен одноразового кода на сессию. */
const handleExchange = async (req: Request): Promise<Response> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_request' });
  }
  const { code, verifier } = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  let steamId: string;
  try {
    steamId = await redeemCode(code, verifier, CODE_SIGNING_KEY, nowSeconds());
  } catch (error) {
    console.warn('steam-auth exchange rejected', String(error));
    return json(400, { error: 'invalid_request' });
  }

  try {
    const session = await issueSession(steamId);
    return json(200, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (error) {
    console.error('steam-auth issueSession failed', error);
    return json(500, { error: 'server_error' });
  }
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop();

  if (req.method === 'GET' && route === 'start') return handleStart(url);
  if (req.method === 'GET' && route === 'callback') return handleCallback(url);
  if (req.method === 'POST' && route === 'exchange') return handleExchange(req);
  return json(404, { error: 'not_found' });
});
