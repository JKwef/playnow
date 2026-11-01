/**
 * Чистая логика входа через Steam OpenID 2.0 и одноразовых кодов.
 * Без обращений к Deno.env и Supabase, поэтому покрывается тестами (openid.test.ts).
 */

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
/** PKCE: base64url(SHA-256) = 43 символа; verifier по RFC 7636 от 43 до 128 символов. */
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** Сколько живёт одноразовый код между редиректом в приложение и обменом на сессию. */
export const CODE_TTL_SECONDS = 120;

export type AuthErrorCode =
  'cancelled' | 'invalid_request' | 'invalid_assertion' | 'steam_unavailable';

export class SteamAuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SteamAuthError';
  }
}

// ---------------------------------------------------------------------------
// base64url и криптография (WebCrypto есть и в Deno, и в браузерах)
// ---------------------------------------------------------------------------

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const encoder = new TextEncoder();

export const sha256Base64Url = async (input: string): Promise<string> =>
  toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));

/** Сравнение без раннего выхода, чтобы время ответа не подсказывало, сколько символов совпало. */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const hmac = async (key: string, data: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))),
  );
};

// ---------------------------------------------------------------------------
// Входные параметры
// ---------------------------------------------------------------------------

export const isValidChallenge = (value: string | null): value is string =>
  value !== null && CHALLENGE_RE.test(value);

export const isValidVerifier = (value: unknown): value is string =>
  typeof value === 'string' && VERIFIER_RE.test(value);

/**
 * Куда можно вернуть пользователя после входа. Без белого списка функция
 * превратилась бы в open redirect, которым удобно маскировать фишинг.
 */
export const isAllowedRedirect = (
  redirect: string | null,
  allowedPrefixes: readonly string[],
): redirect is string =>
  redirect !== null && allowedPrefixes.some((prefix) => redirect.startsWith(prefix));

// ---------------------------------------------------------------------------
// Steam OpenID 2.0
// ---------------------------------------------------------------------------

/** URL страницы входа Steam. realm должен быть префиксом return_to, иначе Steam откажет. */
export const buildSteamLoginUrl = (returnTo: string, realm: string): string => {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
};

export const extractSteamId = (claimedId: string | null): string | null =>
  claimedId?.match(CLAIMED_ID_RE)?.[1] ?? null;

/**
 * Проверяет ответ Steam и возвращает SteamID64.
 *
 * Параметры пришли через браузер пользователя, поэтому им нельзя верить на слово:
 * любой может вручную открыть callback с чужим claimed_id. Поэтому:
 * 1) сверяем, что ответ адресован именно этому запросу (return_to) и от Steam (op_endpoint);
 * 2) отправляем подписанные поля обратно в Steam (check_authentication),
 *    и только он подтверждает подпись. Steam помечает nonce использованным,
 *    так что повторно воспроизвести тот же ответ не выйдет.
 */
export const verifySteamAssertion = async (
  params: URLSearchParams,
  expectedReturnTo: string,
  fetchFn: typeof fetch,
): Promise<string> => {
  const mode = params.get('openid.mode');
  if (mode === 'cancel') {
    throw new SteamAuthError('cancelled', 'Пользователь отменил вход в Steam');
  }
  if (mode !== 'id_res') {
    throw new SteamAuthError('invalid_assertion', `Неожиданный openid.mode: ${mode ?? 'нет'}`);
  }
  if (params.get('openid.op_endpoint') !== STEAM_OPENID_ENDPOINT) {
    throw new SteamAuthError('invalid_assertion', 'Ответ не от Steam');
  }
  // Точное совпадение: return_to подписан Steam, и именно в нём едут challenge и redirect.
  // Если сравнивать только префикс, к чужому валидному ответу можно было бы
  // приписать свой challenge в query callback'а.
  if (params.get('openid.return_to') !== expectedReturnTo) {
    throw new SteamAuthError('invalid_assertion', 'return_to не совпадает');
  }
  const claimedId = params.get('openid.claimed_id');
  const steamId = extractSteamId(claimedId);
  if (steamId === null || params.get('openid.identity') !== claimedId) {
    throw new SteamAuthError('invalid_assertion', 'Некорректный claimed_id');
  }

  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith('openid.')) body.set(key, value);
  }
  body.set('openid.mode', 'check_authentication');

  let text: string;
  try {
    const response = await fetchFn(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new SteamAuthError('steam_unavailable', `Steam ответил ${response.status}`);
    }
    text = await response.text();
  } catch (error) {
    if (error instanceof SteamAuthError) throw error;
    throw new SteamAuthError('steam_unavailable', `Steam недоступен: ${String(error)}`);
  }

  // Ответ в формате key:value построчно. Ищем точную строку, а не подстроку.
  const isValid = text.split('\n').some((line) => line.trim() === 'is_valid:true');
  if (!isValid) {
    throw new SteamAuthError('invalid_assertion', 'Steam не подтвердил подпись');
  }
  return steamId;
};

// ---------------------------------------------------------------------------
// Одноразовый код (stateless): base64url(payload).hmac
// ---------------------------------------------------------------------------

interface CodePayload {
  /** SteamID64, подтверждённый Steam. */
  sid: string;
  /** PKCE challenge, присланный приложением при старте. */
  ch: string;
  /** Unix-время истечения, секунды. */
  exp: number;
}

export const signCode = async (
  steamId: string,
  challenge: string,
  key: string,
  nowSeconds: number,
): Promise<string> => {
  const payload: CodePayload = { sid: steamId, ch: challenge, exp: nowSeconds + CODE_TTL_SECONDS };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(key, encoded)}`;
};

/**
 * Проверяет код и PKCE verifier и возвращает SteamID64.
 * Код из URL мог перехватить кто угодно (на Android схему playnow:// может
 * зарегистрировать чужое приложение), но без verifier, который не покидал
 * наше приложение, обменять его на сессию нельзя.
 */
export const redeemCode = async (
  code: unknown,
  verifier: unknown,
  key: string,
  nowSeconds: number,
): Promise<string> => {
  if (typeof code !== 'string' || !isValidVerifier(verifier)) {
    throw new SteamAuthError('invalid_request', 'Нет code или verifier');
  }
  const [encoded, signature, ...rest] = code.split('.');
  if (encoded === undefined || signature === undefined || rest.length > 0) {
    throw new SteamAuthError('invalid_request', 'Неверный формат кода');
  }
  if (!timingSafeEqual(signature, await hmac(key, encoded))) {
    throw new SteamAuthError('invalid_request', 'Неверная подпись кода');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    throw new SteamAuthError('invalid_request', 'Повреждённый код');
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as CodePayload).sid !== 'string' ||
    typeof (payload as CodePayload).ch !== 'string' ||
    typeof (payload as CodePayload).exp !== 'number'
  ) {
    throw new SteamAuthError('invalid_request', 'Повреждённый код');
  }
  const { sid, ch, exp } = payload as CodePayload;
  if (exp < nowSeconds) {
    throw new SteamAuthError('invalid_request', 'Код истёк');
  }
  if (!timingSafeEqual(await sha256Base64Url(verifier), ch)) {
    throw new SteamAuthError('invalid_request', 'verifier не подходит к коду');
  }
  return sid;
};
