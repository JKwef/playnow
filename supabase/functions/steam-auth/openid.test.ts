// Запуск: deno test supabase/functions/steam-auth/
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import {
  buildSteamLoginUrl,
  CODE_TTL_SECONDS,
  extractSteamId,
  isAllowedRedirect,
  redeemCode,
  sha256Base64Url,
  signCode,
  STEAM_OPENID_ENDPOINT,
  SteamAuthError,
  toBase64Url,
  verifySteamAssertion,
} from './openid.ts';

const STEAM_ID = '76561197960287930';
const RETURN_TO =
  'https://x.supabase.co/functions/v1/steam-auth/callback?challenge=c&redirect=playnow%3A%2F%2Fauth';
const KEY = 'test-key';
const NOW = 1_800_000_000;

const assertion = (overrides: Record<string, string> = {}): URLSearchParams =>
  new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    'openid.return_to': RETURN_TO,
    'openid.response_nonce': '2026-11-01T00:00:00Zabc',
    'openid.assoc_handle': '1234567890',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'sig',
    ...overrides,
  });

/** Фейковый Steam: запоминает тело запроса и отвечает заданным текстом. */
const fakeSteam = (reply: string, status = 200) => {
  const calls: string[] = [];
  const fn = ((_: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(init?.body));
    return Promise.resolve(new Response(reply, { status }));
  }) as typeof fetch;
  return { fn, calls };
};

const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

Deno.test('buildSteamLoginUrl: checkid_setup с identifier_select', () => {
  const url = new URL(buildSteamLoginUrl(RETURN_TO, 'https://x.supabase.co'));
  assertEquals(url.origin + url.pathname, STEAM_OPENID_ENDPOINT);
  assertEquals(url.searchParams.get('openid.mode'), 'checkid_setup');
  assertEquals(url.searchParams.get('openid.return_to'), RETURN_TO);
  assertEquals(url.searchParams.get('openid.realm'), 'https://x.supabase.co');
});

Deno.test('extractSteamId: только канонический claimed_id', () => {
  assertEquals(extractSteamId(`https://steamcommunity.com/openid/id/${STEAM_ID}`), STEAM_ID);
  assertEquals(extractSteamId(`http://steamcommunity.com/openid/id/${STEAM_ID}`), null);
  assertEquals(extractSteamId(`https://evil.com/openid/id/${STEAM_ID}`), null);
  assertEquals(extractSteamId(`https://steamcommunity.com/openid/id/${STEAM_ID}/x`), null);
  assertEquals(extractSteamId(null), null);
});

Deno.test('isAllowedRedirect: белый список префиксов', () => {
  assertEquals(isAllowedRedirect('playnow://auth', ['playnow://']), true);
  assertEquals(isAllowedRedirect('https://evil.com', ['playnow://']), false);
  assertEquals(isAllowedRedirect(null, ['playnow://']), false);
});

Deno.test(
  'verifySteamAssertion: валидный ответ → steamId, Steam получает check_authentication',
  async () => {
    const steam = fakeSteam('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n');
    assertEquals(await verifySteamAssertion(assertion(), RETURN_TO, steam.fn), STEAM_ID);
    const sent = new URLSearchParams(steam.calls[0]);
    assertEquals(sent.get('openid.mode'), 'check_authentication');
    assertEquals(sent.get('openid.sig'), 'sig');
  },
);

Deno.test('verifySteamAssertion: Steam сказал is_valid:false', async () => {
  const steam = fakeSteam('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n');
  await assertRejects(
    () => verifySteamAssertion(assertion(), RETURN_TO, steam.fn),
    SteamAuthError,
    'подпись',
  );
});

Deno.test('verifySteamAssertion: подделки отсекаются до запроса в Steam', async () => {
  const cases: Record<string, string>[] = [
    { 'openid.op_endpoint': 'https://evil.com/openid/login' },
    { 'openid.return_to': RETURN_TO + '&challenge=attacker' },
    { 'openid.claimed_id': 'https://evil.com/openid/id/1' },
    { 'openid.identity': `https://steamcommunity.com/openid/id/76561197960287999` },
    { 'openid.mode': 'setup_needed' },
  ];
  for (const overrides of cases) {
    const steam = fakeSteam('is_valid:true');
    await assertRejects(
      () => verifySteamAssertion(assertion(overrides), RETURN_TO, steam.fn),
      SteamAuthError,
    );
    assertEquals(steam.calls.length, 0, JSON.stringify(overrides));
  }
});

Deno.test('verifySteamAssertion: отмена и недоступный Steam дают свои коды', async () => {
  const cancelled = await assertRejects(
    () => verifySteamAssertion(assertion({ 'openid.mode': 'cancel' }), RETURN_TO, fakeSteam('').fn),
    SteamAuthError,
  );
  assertEquals(cancelled.code, 'cancelled');
  const down = await assertRejects(
    () => verifySteamAssertion(assertion(), RETURN_TO, fakeSteam('oops', 503).fn),
    SteamAuthError,
  );
  assertEquals(down.code, 'steam_unavailable');
});

Deno.test('signCode/redeemCode: успешный обмен', async () => {
  const challenge = await sha256Base64Url(verifier);
  const code = await signCode(STEAM_ID, challenge, KEY, NOW);
  assertEquals(await redeemCode(code, verifier, KEY, NOW + 10), STEAM_ID);
});

Deno.test('redeemCode: чужой verifier, истёкший код, подделанная подпись, мусор', async () => {
  const challenge = await sha256Base64Url(verifier);
  const code = await signCode(STEAM_ID, challenge, KEY, NOW);
  const otherVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await assertRejects(() => redeemCode(code, otherVerifier, KEY, NOW), SteamAuthError, 'verifier');
  await assertRejects(
    () => redeemCode(code, verifier, KEY, NOW + CODE_TTL_SECONDS + 1),
    SteamAuthError,
    'истёк',
  );
  await assertRejects(
    () => redeemCode(code, verifier, 'other-key', NOW),
    SteamAuthError,
    'подпись',
  );
  const [payload] = code.split('.');
  const forged = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ sid: '76561197960287999', ch: challenge, exp: NOW + 100 }),
    ),
  );
  await assertRejects(
    () => redeemCode(`${forged}.${code.split('.')[1]}`, verifier, KEY, NOW),
    SteamAuthError,
    'подпись',
  );
  await assertRejects(() => redeemCode(payload, verifier, KEY, NOW), SteamAuthError);
  await assertRejects(() => redeemCode(code, 'short', KEY, NOW), SteamAuthError);
  await assertRejects(() => redeemCode(42, verifier, KEY, NOW), SteamAuthError);
});
