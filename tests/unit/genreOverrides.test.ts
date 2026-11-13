import { createGenreOverridesService } from '@/features/backlog/services/genreOverrides';

const row = {
  appid: 1,
  name: 'Game',
  genres: ['action'],
  genres_override: ['puzzle'],
  playtime: 61,
};
const fixture = (
  response = { data: row as unknown, error: null as null | { message: string } },
  steamId: string | null = 'A',
) => {
  const builder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => response),
  };
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session:
            steamId === null
              ? null
              : { user: { id: 'user-A', app_metadata: { steam_id: steamId } } },
        },
        error: null,
      }),
    },
    from: jest.fn(() => builder),
  };
  return { builder, client, service: createGenreOverridesService(() => client as never) };
};

test('only the override is saved, scoped to confirmed owner, returned genres prefer it', async () => {
  const { service, builder } = fixture();
  const game = await service.save(1, 'A', ['puzzle', 'puzzle']);
  expect(builder.update).toHaveBeenCalledWith({ genres_override: ['puzzle'] });
  expect(builder.eq.mock.calls).toEqual([
    ['user_id', 'user-A'],
    ['appid', 1],
  ]);
  expect(game.genres).toEqual(['puzzle']);
  expect(game.playtimeMinutes).toBe(61);
});

test('reset clears only the override and restores imported genres', async () => {
  const { service, builder } = fixture({ data: { ...row, genres_override: null }, error: null });
  expect((await service.save(1, 'A', null)).genres).toEqual(['action']);
  expect(builder.update).toHaveBeenCalledWith({ genres_override: null });
});

test('validation rejects empty and unknown genres before touching the network', async () => {
  const { service, client } = fixture();
  for (const genres of [[], ['made-up']])
    await expect(service.save(1, 'A', genres)).rejects.toThrow();
  expect(client.from).not.toHaveBeenCalled();
});

test('cannot save to a changed account or after signout', async () => {
  for (const steamId of ['B', null]) {
    const { service, client } = fixture(undefined, steamId);
    await expect(service.save(1, 'A', ['puzzle'])).rejects.toMatchObject({ code: 'unauthorized' });
    expect(client.from).not.toHaveBeenCalled();
  }
});

test('network errors, database errors and missing rows cannot appear successful', async () => {
  for (const [data, message, code] of [
    [null, 'Failed to fetch', 'network'],
    [null, 'permission denied', 'server'],
    [null, null, 'server'],
  ] as const) {
    const { service } = fixture({ data, error: message === null ? null : { message } });
    await expect(service.save(1, 'A', ['puzzle'])).rejects.toMatchObject({ code });
  }
});
