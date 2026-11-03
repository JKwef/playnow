import { assertEquals } from './helpers/assert';
import { createSteamAuthService } from '@/features/auth/services/steamAuthService';
import { createAuthStore } from '@/features/auth/hooks/useAuth';
import { parseQueryParams } from '@/shared/utils/url';
import { bytesToBase64Url } from '@/shared/utils/base64url';

const okFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const svc = (url: string | null, fetchFn = okFetch({ access_token: 'a', refresh_token: 'r' })) => {
  const opened: string[] = [];
  return {
    opened,
    s: createSteamAuthService({
      functionsBaseUrl: 'https://x.supabase.co/functions/v1/steam-auth',
      redirectUrl: 'playnow://auth',
      openAuthSession: async (u) => {
        opened.push(u);
        return url === null ? { type: 'cancel' } : { type: 'success', url };
      },
      createVerifier: () => 'v'.repeat(43),
      sha256Base64Url: async () => 'c'.repeat(43),
      fetch: fetchFn,
    }),
  };
};

test('base64url matches std', () => {
  for (const n of [0, 1, 2, 3, 31, 32, 33]) {
    const b = crypto.getRandomValues(new Uint8Array(n));
    const std = btoa(String.fromCharCode(...b))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    assertEquals(bytesToBase64Url(b), std);
  }
});
test('parseQueryParams', () => {
  assertEquals(parseQueryParams('playnow://auth?code=a%2Bb.c&x=1#y=2'), {
    code: 'a+b.c',
    x: '1',
    y: '2',
  });
  assertEquals(parseQueryParams('exp://1.2.3.4:8081/--/auth?error=cancelled'), {
    error: 'cancelled',
  });
  assertEquals(parseQueryParams('playnow://auth'), {});
});
test('service: success, start url', async () => {
  const { s, opened } = svc('playnow://auth?code=abc.def');
  assertEquals(await s.signIn(), {
    kind: 'success',
    tokens: { accessToken: 'a', refreshToken: 'r' },
  });
  assertEquals(
    opened[0],
    'https://x.supabase.co/functions/v1/steam-auth/start?challenge=' +
      'c'.repeat(43) +
      '&redirect=playnow%3A%2F%2Fauth',
  );
});
test('service: cancel paths', async () => {
  assertEquals(await svc(null).s.signIn(), { kind: 'cancelled' });
  assertEquals(await svc('playnow://auth?error=cancelled').s.signIn(), { kind: 'cancelled' });
});
test('service: errors map to codes', async () => {
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'none';
    } catch (e) {
      return (e as { code: string }).code;
    }
  };
  assertEquals(
    await code(svc('playnow://auth?error=steam_unavailable').s.signIn()),
    'steam_unavailable',
  );
  assertEquals(await code(svc('playnow://auth?error=invalid_assertion').s.signIn()), 'rejected');
  assertEquals(await code(svc('playnow://auth').s.signIn()), 'rejected');
  assertEquals(await code(svc('playnow://auth?code=x', okFetch({}, 400)).s.signIn()), 'rejected');
  assertEquals(await code(svc('playnow://auth?code=x', okFetch({}, 502)).s.signIn()), 'server');
  assertEquals(
    await code(svc('playnow://auth?code=x', okFetch({ access_token: 1 })).s.signIn()),
    'server',
  );
  assertEquals(
    await code(
      svc('playnow://auth?code=x', (async () => {
        throw new TypeError('Network request failed');
      }) as typeof fetch).s.signIn(),
    ),
    'network',
  );
});

const session = (steam_id?: string) => ({ user: { app_metadata: steam_id ? { steam_id } : {} } });
const fakeAuth = (stored: unknown) => {
  let cb: ((e: string, s: unknown) => void) | null = null;
  const calls: string[] = [];
  return {
    calls,
    emit: (e: string, s: unknown) => cb?.(e, s),
    client: {
      getSession: async () => ({ data: { session: stored }, error: null }),
      setSession: async () => {
        calls.push('set');
        return { data: { session: session('76561197960287930') }, error: null };
      },
      signOut: async () => {
        calls.push('signOut');
        return { error: null };
      },
      onAuthStateChange: (f: typeof cb) => {
        cb = f;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
};
test('store: restore, signIn, token expiry, signOut', async () => {
  const fa = fakeAuth(null);
  const store = createAuthStore({
    getAuthClient: () => fa.client as never,
    getSteamAuth: () => svc('playnow://auth?code=x').s,
  });
  assertEquals(store.getState().status, 'unknown');
  await store.getState().restoreSession();
  assertEquals(store.getState().status, 'signedOut');
  await store.getState().signIn();
  assertEquals(store.getState().status, 'signedIn');
  assertEquals(store.getState().user, { steamId: '76561197960287930' });
  fa.emit('SIGNED_OUT', null);
  assertEquals(store.getState().status, 'signedOut');
  await store.getState().signOut();
  assertEquals(fa.calls, ['set', 'signOut']);
});
test('store: restores saved session; foreign session wiped', async () => {
  const ok = createAuthStore({
    getAuthClient: () => fakeAuth(session('76561197960287930')).client as never,
    getSteamAuth: () => svc(null).s,
  });
  await ok.getState().restoreSession();
  assertEquals(ok.getState().status, 'signedIn');
  const fa = fakeAuth(session());
  const bad = createAuthStore({
    getAuthClient: () => fa.client as never,
    getSteamAuth: () => svc(null).s,
  });
  await bad.getState().restoreSession();
  assertEquals(bad.getState().status, 'signedOut');
  assertEquals(fa.calls, ['signOut']);
});
test('store: errors become messages, cancel is silent', async () => {
  const s1 = createAuthStore({
    getAuthClient: () => fakeAuth(null).client as never,
    getSteamAuth: () => svc('playnow://auth?error=steam_unavailable').s,
  });
  await s1.getState().signIn();
  assertEquals(s1.getState().error, 'Steam сейчас недоступен. Попробуйте позже');
  const s2 = createAuthStore({
    getAuthClient: () => fakeAuth(null).client as never,
    getSteamAuth: () => svc(null).s,
  });
  await s2.getState().signIn();
  assertEquals([s2.getState().status, s2.getState().error], ['signedOut', null]);
});
