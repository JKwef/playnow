// Запуск: deno test supabase/functions/rawg-enrich/
import { assertEquals } from 'jsr:@std/assert@1';

import {
  findSteamCover,
  isSteamImageUrl,
  parseAppDetailsHeader,
  steamTemplateCoverUrl,
} from './steamCover.ts';

const HASHED =
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4080220/ff6a/header.jpg';

const fakeFetch = (routes: Record<string, () => Response | Promise<Response>>, calls: string[]) =>
  ((input: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${input.split('?')[0]}`);
    const route = Object.keys(routes).find((prefix) => input.startsWith(prefix));
    return Promise.resolve(route ? routes[route]!() : new Response('', { status: 404 }));
  }) as unknown as typeof fetch;

Deno.test('findSteamCover: шаблон работает — appdetails не нужен', async () => {
  const calls: string[] = [];
  const cover = await findSteamCover(570, {
    timeoutMs: 1000,
    fetch: fakeFetch(
      { [steamTemplateCoverUrl(570)]: () => new Response('', { status: 200 }) },
      calls,
    ),
  });
  assertEquals(cover, steamTemplateCoverUrl(570));
  assertEquals(calls.length, 1);
});

Deno.test('findSteamCover: шаблон 404 — адрес с хэшем из appdetails', async () => {
  const calls: string[] = [];
  const cover = await findSteamCover(4080220, {
    timeoutMs: 1000,
    fetch: fakeFetch(
      {
        'https://store.steampowered.com/api/appdetails': () =>
          Response.json({ '4080220': { success: true, data: { header_image: HASHED } } }),
      },
      calls,
    ),
  });
  assertEquals(cover, HASHED);
  assertEquals(calls, [
    `HEAD ${steamTemplateCoverUrl(4080220)}`,
    'GET https://store.steampowered.com/api/appdetails',
  ]);
});

Deno.test('findSteamCover: сбой сети — null, без исключения', async () => {
  const cover = await findSteamCover(1, {
    timeoutMs: 1000,
    fetch: (() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch,
  });
  assertEquals(cover, null);
});

Deno.test('parseAppDetailsHeader валидирует ответ и домен', () => {
  assertEquals(parseAppDetailsHeader({ '5': { success: false } }, 5), null);
  assertEquals(
    parseAppDetailsHeader(
      { '5': { success: true, data: { header_image: 'https://evil.example/x.jpg' } } },
      5,
    ),
    null,
  );
  assertEquals(
    parseAppDetailsHeader({ '5': { success: true, data: { header_image: HASHED } } }, 5),
    HASHED,
  );
  assertEquals(parseAppDetailsHeader(null, 5), null);
  assertEquals(isSteamImageUrl('http://cdn.cloudflare.steamstatic.com/x.jpg'), false);
});
