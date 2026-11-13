// Integration test against an explicitly configured Supabase. Never sends email.
// Creates isolated Auth fixtures and removes them in finally; credentials stay in memory.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anon && service, 'Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const admin = createClient(url, service, options);
const users = [];
const snapshot = (id) => ({
  choice: {
    game: { appid: id, name: `QA ${id}` },
    mode: 'new',
    contextId: 'action',
    genreFilter: 'any',
    acceptedAt: new Date().toISOString(),
  },
  postponed: { 620: Date.now() + 86400000 },
});
const checked = ({ data, error }) => {
  if (error) throw new Error(`Supabase integration failure: ${error.code ?? error.name}`);
  return data;
};
async function fixture() {
  const link = checked(
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: `sync-${randomUUID()}@example.com`,
    }),
  );
  assert(link.user && link.properties.hashed_token);
  users.push(link.user.id);
  const client = createClient(url, anon, options);
  checked(await client.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token }));
  return { id: link.user.id, client };
}
const write = async (client, id, revision, operation, value) =>
  checked(
    await client.rpc('write_picker_sync', {
      expected_user_id: id,
      expected_revision: revision,
      operation_id: operation,
      new_snapshot: value,
    }),
  );
try {
  const a = await fixture();
  const b = await fixture();
  const secondSession = createClient(url, anon, options);
  const session = checked(await a.client.auth.getSession()).session;
  checked(
    await secondSession.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  );
  const first = snapshot(620);
  const next = snapshot(570);
  const op1 = randomUUID();
  const op2 = randomUUID();
  const replies = await Promise.all([
    write(a.client, a.id, 0, op1, first),
    write(secondSession, a.id, 0, op2, next),
  ]);
  assert.deepEqual(replies.map((r) => r.applied).sort(), [false, true]);
  assert(replies.every((r) => r.revision === 1));
  const winner = replies[0].applied
    ? { operation: op1, value: first }
    : { operation: op2, value: next };
  const retry = await write(a.client, a.id, 0, winner.operation, winner.value);
  assert.equal(retry.applied, true);
  assert.equal(retry.revision, 1);
  const pulled = checked(
    await secondSession
      .from('picker_sync_state')
      .select('snapshot,revision')
      .eq('user_id', a.id)
      .single(),
  );
  assert.deepEqual(pulled.snapshot, winner.value);
  assert.deepEqual(
    checked(await b.client.from('picker_sync_state').select('*').eq('user_id', a.id)),
    [],
  );
  const rejected = await b.client.rpc('write_picker_sync', {
    expected_user_id: a.id,
    expected_revision: 1,
    operation_id: randomUUID(),
    new_snapshot: first,
  });
  assert.equal(rejected.error?.code, '42501');
  const direct = await a.client
    .from('picker_sync_state')
    .update({ snapshot: first })
    .eq('user_id', a.id);
  assert.equal(direct.error?.code, '42501');
  const cleared = await write(a.client, a.id, 1, randomUUID(), { choice: null, postponed: {} });
  assert.equal(cleared.revision, 2);
  assert.equal(cleared.applied, true);
  console.log(
    'PASS: real API sessions, parallel CAS, idempotent retry, cross-account isolation, direct-DML denial and clearing',
  );
} finally {
  for (const id of users) checked(await admin.auth.admin.deleteUser(id));
  if (users.length) {
    assert.deepEqual(
      checked(await admin.from('picker_sync_state').select('user_id').in('user_id', users)),
      [],
    );
    console.log('PASS: test Auth users removed and sync rows cascaded');
  }
}
