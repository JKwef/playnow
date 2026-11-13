import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { LIBRARY_PAGE_SIZE, readLibrary, withSteamImportSource } from './library.ts';

Deno.test(
  'only the current Steam response confirms imported history, including manual real-appid games',
  () => {
    const rows = [{ appid: 730 }, { appid: 620 }, { appid: 2000000001 }];
    assertEquals(
      withSteamImportSource(rows, new Set([730])).map((row) => row.steam_imported),
      [true, false, false],
    );
    assertEquals(
      withSteamImportSource(rows, new Set([730, 620])).map((row) => row.steam_imported),
      [true, true, false],
    );
    assertEquals(rows, [{ appid: 730 }, { appid: 620 }, { appid: 2000000001 }]);
  },
);

for (const count of [0, 1, 500, 1500]) {
  Deno.test(
    `readLibrary: all ${count} rows including a manual game, stable despite equal names`,
    async () => {
      const rows = Array.from({ length: count }, (_, index) => ({
        appid: index === count - 1 ? 2_000_000_001 : index + 1,
        name: 'Same title',
      }));
      const calls: number[] = [];
      const games = await readLibrary(async (after, limit) => {
        calls.push(after);
        assertEquals(limit, LIBRARY_PAGE_SIZE);
        return { data: rows.filter((row) => row.appid > after).slice(0, limit), error: null };
      });
      assertEquals(games, rows);
      assertEquals(new Set(games.map((game) => game.appid)).size, count);
      assertEquals(calls.length, Math.ceil(count / LIBRARY_PAGE_SIZE) + 1);
    },
  );
}

Deno.test('readLibrary: smaller server cap does not truncate the library', async () => {
  const rows = Array.from({ length: 550 }, (_, index) => ({ appid: index + 1 }));
  assertEquals(
    await readLibrary(async (after) => ({
      data: rows.filter((row) => row.appid > after).slice(0, 100),
      error: null,
    })),
    rows,
  );
});

Deno.test(
  'readLibrary: a failed page fails the import, never returns a partial library',
  async () => {
    await assertRejects(
      () =>
        readLibrary(async (after) =>
          after === 0
            ? { data: [{ appid: 1 }], error: null }
            : { data: null, error: new Error('database unavailable') },
        ),
      Error,
      'database unavailable',
    );
  },
);

Deno.test(
  'readLibrary: duplicates, broken ordering and absent pages fail instead of looping',
  async () => {
    for (const data of [[{ appid: 2 }, { appid: 1 }], [{ appid: 1 }, { appid: 1 }], null]) {
      await assertRejects(() => readLibrary(async () => ({ data, error: null })));
    }
  },
);
