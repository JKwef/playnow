import { createPickerSyncStore } from '@/features/picker/services/pickerSync';
import {
  mergePickerSnapshots,
  parsePickerSnapshot,
  type PickerSnapshot,
  type PickerSyncRemote,
  type RemotePickerState,
} from '@/features/picker/services/pickerSyncModel';
import { invalidateAccount } from '@/shared/services/accountScope';

const now = 1794564000000;
const choice = (appid: number) => ({
  game: { appid, name: `Game ${appid}` },
  contextId: 'action' as const,
  mode: 'new' as const,
  genreFilter: 'any' as const,
  acceptedAt: new Date(now).toISOString(),
});
const empty = (): PickerSnapshot => ({ choice: null, postponed: {} });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}
function server() {
  let state: RemotePickerState = { revision: 0, mutationId: null, snapshot: empty() };
  const remote: PickerSyncRemote = {
    read: jest.fn(async () => clone(state)),
    write: jest.fn(async (_account, revision, mutationId, snapshot) => {
      const applied = revision === state.revision || mutationId === state.mutationId;
      if (applied && mutationId !== state.mutationId)
        state = { revision: state.revision + 1, mutationId, snapshot: clone(snapshot) };
      return { ...clone(state), applied };
    }),
  };
  return { remote, state: () => clone(state) };
}
function device(remote: PickerSyncRemote, storage = memory()) {
  let sequence = 0;
  const store = createPickerSyncStore(
    remote,
    storage,
    () => `op-${++sequence}`,
    () => now,
  );
  return {
    store,
    storage,
    state: store.getState,
    local: (snapshot: PickerSnapshot) => {
      storage.values.set('playnow:acceptedChoice:v1:A', JSON.stringify(snapshot.choice));
      storage.values.set('playnow:blacklist:v1:A', JSON.stringify(snapshot.postponed));
    },
    read: async () =>
      parsePickerSnapshot(
        {
          choice: JSON.parse((await storage.getItem('playnow:acceptedChoice:v1:A')) ?? 'null'),
          postponed: JSON.parse((await storage.getItem('playnow:blacklist:v1:A')) ?? '{}'),
        },
        now,
      ),
  };
}
let sequence = 0;
// Operation ids must be unique across separate device instances too.
const unique = (remote: PickerSyncRemote) => {
  const result = device(remote);
  const store = createPickerSyncStore(
    remote,
    result.storage,
    () => `unique-${++sequence}`,
    () => now,
  );
  return { ...result, store, state: store.getState };
};

test('disabled by default: no network; opting out preserves server and local data', async () => {
  const s = server();
  const d = unique(s.remote);
  d.local({ ...empty(), choice: choice(1) });
  await d.state().load('A');
  await d.state().sync('A');
  expect(s.remote.read).not.toHaveBeenCalled();
  await d.state().enable('A', true);
  expect(s.state().snapshot.choice).toEqual(choice(1));
  await d.state().enable('A', false);
  d.local(empty());
  await d.state().sync('A');
  expect(s.state().snapshot.choice).toEqual(choice(1));
  expect(d.state().phase).toBe('disabled');
});

test('two devices pull a choice and merge independent postponements; removal does not resurrect', async () => {
  const s = server();
  const a = unique(s.remote);
  const b = unique(s.remote);
  await a.state().load('A');
  await b.state().load('A');
  a.local({ choice: choice(1), postponed: { '1': now + 10000 } });
  await a.state().enable('A', true);
  await b.state().enable('A', true);
  expect(await b.read()).toEqual(await a.read());
  a.local({ choice: choice(1), postponed: {} });
  b.local({ choice: choice(1), postponed: { '1': now + 10000, '2': now + 20000 } });
  await a.state().sync('A');
  await b.state().sync('A');
  await a.state().sync('A');
  expect(await a.read()).toEqual({ choice: choice(1), postponed: { '2': now + 20000 } });
  expect(await b.read()).toEqual(await a.read());
});

test.each(['local', 'remote'] as const)(
  'conflicting accepted choices require explicit %s resolution',
  async (version) => {
    const s = server();
    const a = unique(s.remote);
    const b = unique(s.remote);
    await a.state().load('A');
    await b.state().load('A');
    await a.state().enable('A', true);
    await b.state().enable('A', true);
    a.local({ ...empty(), choice: choice(1) });
    b.local({ ...empty(), choice: choice(2) });
    await a.state().sync('A');
    await b.state().sync('A');
    expect(b.state().phase).toBe('conflict');
    expect((await b.read()).choice).toEqual(choice(2));
    await b.state().resolve('A', version);
    expect(b.state().phase).toBe('synced');
    expect((await b.read()).choice).toEqual(choice(version === 'local' ? 2 : 1));
    expect(s.state().snapshot).toEqual(await b.read());
  },
);

test('first enable never silently overwrites a nonempty local version; changed conflict must be reviewed again', async () => {
  const s = server();
  const a = unique(s.remote);
  const b = unique(s.remote);
  await a.state().load('A');
  a.local({ ...empty(), choice: choice(1) });
  await a.state().enable('A', true);
  await b.state().load('A');
  b.local({ ...empty(), choice: choice(2) });
  await b.state().enable('A', true);
  expect(b.state().phase).toBe('conflict');
  a.local({ ...empty(), choice: choice(3) });
  await a.state().sync('A');
  await b.state().resolve('A', 'local');
  expect(b.state().phase).toBe('conflict');
  expect(b.state().error).toContain('изменились');
  expect(s.state().snapshot.choice).toEqual(choice(3));
  await b.state().resolve('A', 'remote');
  expect((await b.read()).choice).toEqual(choice(3));
});

test('offline edits survive process restart and synchronize on retry', async () => {
  const s = server();
  const d = unique(s.remote);
  await d.state().load('A');
  await d.state().enable('A', true);
  d.local({ ...empty(), choice: choice(7) });
  const read = s.remote.read;
  s.remote.read = jest.fn(async () => {
    throw new Error('offline');
  });
  await d.state().sync('A');
  expect(d.state().phase).toBe('error');
  s.remote.read = read;
  const restarted = createPickerSyncStore(
    s.remote,
    d.storage,
    () => 'restart-op',
    () => now,
  );
  await restarted.getState().load('A');
  expect(restarted.getState().phase).toBe('synced');
  expect(s.state().snapshot.choice).toEqual(choice(7));
});

test('lost acknowledgement retries the same operation after restart without duplicating revision', async () => {
  const s = server();
  const d = unique(s.remote);
  await d.state().load('A');
  await d.state().enable('A', true);
  d.local({ ...empty(), choice: choice(7) });
  const write = s.remote.write;
  s.remote.write = jest.fn(async (...args) => {
    await write(...args);
    throw new Error('lost response');
  });
  await d.state().sync('A');
  expect(d.state().phase).toBe('error');
  expect(s.state().revision).toBe(1);
  s.remote.write = jest.fn(write);
  const restarted = createPickerSyncStore(
    s.remote,
    d.storage,
    () => 'new-op',
    () => now,
  );
  await restarted.getState().load('A');
  expect(restarted.getState().phase).toBe('synced');
  expect(s.state().revision).toBe(1);
});

test('partially applied cloud snapshot recovers from durable journal after a disk failure', async () => {
  const s = server();
  const a = unique(s.remote);
  const b = unique(s.remote);
  await a.state().load('A');
  await b.state().load('A');
  await a.state().enable('A', true);
  await b.state().enable('A', true);
  a.local({ choice: choice(9), postponed: { '9': now + 5000 } });
  await a.state().sync('A');
  const save = b.storage.setItem.getMockImplementation()!;
  b.storage.setItem.mockImplementation(async (key, value) => {
    if (key.includes('blacklist')) throw new Error('disk');
    await save(key, value);
  });
  await b.state().sync('A');
  expect(b.state().phase).toBe('error');
  b.storage.setItem.mockImplementation(save);
  const restarted = createPickerSyncStore(
    s.remote,
    b.storage,
    () => 'recover',
    () => now,
  );
  await restarted.getState().load('A');
  expect(restarted.getState().phase).toBe('synced');
  expect(await b.read()).toEqual(s.state().snapshot);
});

test('edits made during a network write are rebased and sent in a subsequent operation', async () => {
  const s = server();
  const d = unique(s.remote);
  await d.state().load('A');
  await d.state().enable('A', true);
  d.local({ ...empty(), choice: choice(1) });
  const write = s.remote.write;
  s.remote.write = jest.fn(async (...args) => {
    const response = await write(...args);
    d.local({ choice: choice(1), postponed: { '4': now + 1000 } });
    s.remote.write = write;
    return response;
  });
  await d.state().sync('A');
  expect(d.state().phase).toBe('synced');
  expect(s.state().snapshot).toEqual(await d.read());
  expect(s.state().snapshot.postponed).toEqual({ '4': now + 1000 });
});

test('a CAS race requires review and stale account responses cannot restore deleted data', async () => {
  const s = server();
  const d = unique(s.remote);
  await d.state().load('A');
  await d.state().enable('A', true);
  d.local({ ...empty(), choice: choice(1) });
  const write = s.remote.write;
  s.remote.write = async (...args) => {
    await write('A', 0, 'other-device', { ...empty(), choice: choice(2) });
    return write(...args);
  };
  await d.state().sync('A');
  expect(d.state().phase).toBe('conflict');
  expect((await d.read()).choice).toEqual(choice(1));
  s.remote.write = write;
  s.remote.read = async () => {
    invalidateAccount('A');
    d.storage.values.clear();
    return s.state();
  };
  await d.state().sync('A');
  expect(d.storage.values.size).toBe(0);
  d.state().reset();
  await d.state().load('B');
  expect(d.state().account).toBe('B');
  expect(d.state().phase).toBe('disabled');
});

test('corrupt metadata or local data fails closed without pushing an empty snapshot', async () => {
  const s = server();
  const d = unique(s.remote);
  d.storage.values.set('playnow:pickerSync:v1:A', '{broken');
  await d.state().load('A');
  expect(d.state().phase).toBe('error');
  expect(s.remote.read).not.toHaveBeenCalled();
  d.storage.values.clear();
  await d.state().load('A');
  d.storage.values.set('playnow:blacklist:v1:A', '[]');
  await d.state().enable('A', true);
  expect(d.state().phase).toBe('error');
  expect(s.remote.write).not.toHaveBeenCalled();
});

test('model expires postponements, rejects malformed payloads and detects same-game deadline conflicts', () => {
  expect(
    parsePickerSnapshot({ choice: choice(1), postponed: { '1': now, '2': now + 1 } }, now)
      .postponed,
  ).toEqual({ '2': now + 1 });
  for (const value of [
    null,
    {},
    { choice: null, postponed: [] },
    { choice: null, postponed: { '01': now } },
    { choice: null, postponed: { '1': 0 } },
    { choice: {}, postponed: {} },
  ])
    expect(() => parsePickerSnapshot(value)).toThrow();
  expect(
    mergePickerSnapshots(
      empty(),
      { ...empty(), postponed: { '1': 5 } },
      { ...empty(), postponed: { '1': 6 } },
    ),
  ).toBeNull();
});
