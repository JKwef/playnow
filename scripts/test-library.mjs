/** Local Supabase integration test. Uses the real pagination helper and psql. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { readLibrary, withSteamImportSource } from '../supabase/functions/steam-library/library.ts';

const databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const schema = `qa_library_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^qa_library_[0-9a-f]{32}$/);

const sql = (query) => {
  const result = spawnSync('psql', [databaseUrl, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim().split(/\r?\n/).at(-1);
};

try {
  sql(
    `create schema ${schema}; revoke all on schema ${schema} from public, anon, authenticated; create table ${schema}.games (appid integer primary key, name text not null);`,
  );
  for (const count of [0, 1, 500, 1500]) {
    sql(
      `truncate ${schema}.games; insert into ${schema}.games select case when i=${count} then 2000000001 else i end, 'Same title' from generate_series(1,${count}) i;`,
    );
    const games = await readLibrary(async (after, limit) => {
      assert(Number.isSafeInteger(after) && Number.isSafeInteger(limit));
      const data = JSON.parse(
        sql(
          `select coalesce(json_agg(t), '[]'::json) from (select appid,name from ${schema}.games where appid>${after} order by appid limit ${limit}) t;`,
        ),
      );
      return { data, error: null };
    });
    assert.equal(games.length, count);
    assert.equal(new Set(games.map((game) => game.appid)).size, count);
    if (count > 0) assert.equal(games.at(-1).appid, 2000000001);
    const owned = new Set(
      games
        .filter((game) => game.appid !== 620 && game.appid < 2000000000)
        .map((game) => game.appid),
    );
    const tagged = withSteamImportSource(games, owned);
    if (count > 0) assert.equal(tagged.at(-1).steam_imported, false);
    if (count > 620) assert.equal(tagged.find((game) => game.appid === 620).steam_imported, false);
    assert.equal(tagged.filter((game) => game.steam_imported).length, owned.size);
    process.stdout.write(`PASS: ${count} games, including manual games, no duplicates\n`);
  }
} finally {
  sql(`drop schema if exists ${schema} cascade;`);
}
assert.equal(sql(`select exists(select 1 from pg_namespace where nspname='${schema}');`), 'f');
