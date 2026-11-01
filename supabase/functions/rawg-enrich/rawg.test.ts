// Запуск: deno test supabase/functions/rawg-enrich/
import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';

import {
  buildSearchUrl,
  nameSimilarity,
  normalizeGenres,
  normalizeName,
  pickRawgMatch,
  RAWG_PAGE_SIZE,
} from './rawg.ts';

Deno.test('normalizeName убирает ™®, регистр и пунктуацию', () => {
  assertEquals(normalizeName('The Witcher® 3: Wild Hunt™'), 'the witcher 3 wild hunt');
  assertEquals(normalizeName('Ori & the Blind Forest'), 'ori and the blind forest');
  assertEquals(normalizeName('Pokémon'), 'pokemon');
});

Deno.test('nameSimilarity: одинаковые, частично, разные', () => {
  assertEquals(nameSimilarity('Hades', 'HADES'), 1);
  assert(nameSimilarity('Portal', 'Portal 2') < 0.6);
  assertEquals(nameSimilarity('Hades', 'Celeste'), 0);
});

Deno.test('normalizeGenres: псевдонимы жанров и теги roguelike/narrative', () => {
  assertEquals(
    normalizeGenres(
      ['action', 'role-playing-games-rpg', 'indie'],
      ['singleplayer', 'roguelite', 'story-rich', 'roguelike', 'fps'],
    ),
    ['action', 'rpg', 'indie', 'roguelike', 'narrative', 'shooter'],
  );
});

const rawgGame = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  background_image: `https://media.rawg.io/${encodeURIComponent(name)}.jpg`,
  genres: [{ slug: 'action', name: 'Action' }],
  tags: [{ slug: 'roguelike' }],
  ...extra,
});

Deno.test('pickRawgMatch предпочитает точное совпадение, а не первый результат', () => {
  const match = pickRawgMatch(
    {
      results: [
        rawgGame('Portal 2', { genres: [{ slug: 'puzzle' }, { slug: 'shooter' }] }),
        rawgGame('Portal', { genres: [{ slug: 'puzzle' }], tags: [] }),
      ],
    },
    'Portal™',
  );
  assertEquals(match, { genres: ['puzzle'], coverUrl: 'https://media.rawg.io/Portal.jpg' });
});

Deno.test('pickRawgMatch: похожее название подходит, чужая игра — нет', () => {
  assertEquals(pickRawgMatch({ results: [rawgGame('Hades')] }, 'Hades')?.genres, [
    'action',
    'roguelike',
  ]);
  assertEquals(
    pickRawgMatch({ results: [rawgGame('Slay the Spire: Ascension')] }, 'Slay the Spire')?.genres,
    ['action', 'roguelike'],
  );
  assertEquals(pickRawgMatch({ results: [rawgGame('Celeste')] }, 'Hades'), null);
  assertEquals(pickRawgMatch({ results: [] }, 'Hades'), null);
});

Deno.test('pickRawgMatch валидирует данные: битые жанры, http-обложка', () => {
  const match = pickRawgMatch(
    {
      results: [
        {
          name: 'Hades',
          background_image: 'http://insecure.example/x.jpg',
          genres: [{ slug: 'Action<script>' }, null, { slug: 'puzzle' }, 'arcade'],
          tags: 'oops',
        },
      ],
    },
    'Hades',
  );
  assertEquals(match, { genres: ['puzzle'], coverUrl: null });
});

Deno.test('pickRawgMatch бросает на неожиданном формате', () => {
  assertThrows(() => pickRawgMatch({ detail: 'error' }, 'Hades'));
  assertThrows(() => pickRawgMatch(null, 'Hades'));
});

Deno.test('buildSearchUrl: https, ключ, page_size, без управляющих символов', () => {
  const url = new URL(buildSearchUrl('KEY', ' Hades\u0000\n'));
  assertEquals(url.origin + url.pathname, 'https://api.rawg.io/api/games');
  assertEquals(url.searchParams.get('key'), 'KEY');
  assertEquals(url.searchParams.get('search'), 'Hades');
  assertEquals(url.searchParams.get('page_size'), String(RAWG_PAGE_SIZE));
});
