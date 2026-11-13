import {
  createPickerSyncRemote,
  parseRemotePickerState,
} from '@/features/picker/services/pickerSyncRemote';
const snapshot = { choice: null, postponed: { '620': 1795000000000 } };
function fixture(account: string | null = 'A') {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: null as unknown, error: null as unknown })),
  };
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session:
            account === null
              ? null
              : { user: { id: 'uuid-A', app_metadata: { steam_id: account } } },
        },
        error: null,
      }),
    },
    from: jest.fn(() => builder),
    rpc: jest.fn(async () => ({
      data: { revision: 1, snapshot, mutationId: 'op1', applied: true } as unknown,
      error: null as unknown,
    })),
  };
  return { client, builder, remote: createPickerSyncRemote(() => client as never) };
}
test('read defaults to revision zero and always filters by the authenticated UUID', async () => {
  const f = fixture();
  expect((await f.remote.read('A')).revision).toBe(0);
  expect(f.builder.eq).toHaveBeenCalledWith('user_id', 'uuid-A');
  f.builder.maybeSingle.mockResolvedValue({
    data: { revision: 2, snapshot, mutation_id: 'op2' },
    error: null,
  });
  expect(await f.remote.read('A')).toEqual({ revision: 2, snapshot, mutationId: 'op2' });
});
test.each([null, 'B'])('changed or missing session %s cannot read or write', async (account) => {
  const f = fixture(account);
  await expect(f.remote.read('A')).rejects.toThrow('Account changed');
  await expect(f.remote.write('A', 0, 'op', snapshot)).rejects.toThrow('Account changed');
  expect(f.client.from).not.toHaveBeenCalled();
  expect(f.client.rpc).not.toHaveBeenCalled();
});
test('CAS includes expected identity and operation id, and transport errors never become empty data', async () => {
  const f = fixture();
  expect((await f.remote.write('A', 0, 'op1', snapshot)).applied).toBe(true);
  expect(f.client.rpc).toHaveBeenCalledWith('write_picker_sync', {
    expected_user_id: 'uuid-A',
    expected_revision: 0,
    operation_id: 'op1',
    new_snapshot: snapshot,
  });
  f.client.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(f.remote.write('A', 1, 'op2', snapshot)).rejects.toThrow('offline');
  f.builder.maybeSingle.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(f.remote.read('A')).rejects.toThrow('offline');
  f.client.rpc.mockResolvedValue({
    data: { revision: 2, snapshot, mutationId: 'op2' },
    error: null,
  });
  await expect(f.remote.write('A', 1, 'op2', snapshot)).rejects.toThrow('acknowledgement');
});
test.each([
  null,
  {},
  { revision: -1 },
  { revision: 1.5 },
  { revision: 1, snapshot, mutationId: 3 },
  { revision: 1, snapshot: null, mutationId: null },
])('reject malformed server state %j', (value) => {
  expect(() => parseRemotePickerState(value)).toThrow();
});
