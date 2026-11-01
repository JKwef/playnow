// Запуск: deno test supabase/functions/steam-library/
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { buildOwnedGamesUrl, parseOwnedGames } from './steam.ts';

Deno.test('parseOwnedGames: обычный ответ', () => {
  const result = parseOwnedGames({
    response: {
      game_count: 2,
      games: [
        {
          appid: 730,
          name: 'Counter-Strike 2',
          playtime_forever: 1234.9,
          img_icon_url: 'x',
          rtime_last_played: 1700000000,
        },
        { appid: 570, name: '  Dota 2 ', playtime_forever: 0 },
      ],
    },
  });
  assertEquals(result, {
    kind: 'ok',
    games: [
      {
        appid: 730,
        name: 'Counter-Strike 2',
        playtime: 1234,
        lastPlayedAt: '2023-11-14T22:13:20.000Z',
      },
      { appid: 570, name: 'Dota 2', playtime: 0, lastPlayedAt: null },
    ],
  });
});

Deno.test('parseOwnedGames: приватный профиль = пустой response', () => {
  assertEquals(parseOwnedGames({ response: {} }), { kind: 'private' });
});

Deno.test('parseOwnedGames: открытый профиль без игр', () => {
  assertEquals(parseOwnedGames({ response: { game_count: 0 } }), { kind: 'ok', games: [] });
});

Deno.test('parseOwnedGames: мусорные записи пропускаются, дубликаты схлопываются', () => {
  const result = parseOwnedGames({
    response: {
      game_count: 5,
      games: [
        null,
        { appid: '730', name: 'string appid' },
        { appid: -1, name: 'negative' },
        { appid: 440, playtime_forever: -5 },
        { appid: 440, name: 'dup' },
      ],
    },
  });
  assertEquals(result, {
    kind: 'ok',
    games: [{ appid: 440, name: 'App 440', playtime: 0, lastPlayedAt: null }],
  });
});

Deno.test('parseOwnedGames: не тот формат', () => {
  assertThrows(() => parseOwnedGames(null));
  assertThrows(() => parseOwnedGames({ foo: 1 }));
});

Deno.test('buildOwnedGamesUrl: параметры из ТЗ', () => {
  const url = new URL(buildOwnedGamesUrl('KEY', '76561197960287930'));
  assertEquals(url.searchParams.get('key'), 'KEY');
  assertEquals(url.searchParams.get('steamid'), '76561197960287930');
  assertEquals(url.searchParams.get('include_appinfo'), 'true');
  assertEquals(url.searchParams.get('format'), 'json');
  assertEquals(url.searchParams.get('include_free_sub'), 'true');
  assertEquals(url.searchParams.get('skip_unvetted_apps'), 'false');
});
