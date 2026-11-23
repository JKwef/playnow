import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  playedLibrary,
  rankOffers,
  type StoreGenre,
  type StoreOffer,
} from '@/features/purchases/catalog';
import { readSettings, updateSettings } from '@/features/purchases/services/purchaseSettings';
import { accountRevision } from '@/shared/services/accountScope';
import { clearAccountData } from '@/shared/services/accountData';
import { makeGame } from './fixtures/game';

const offer = (appid: number, name: string, ...genres: StoreGenre[]): StoreOffer => ({
  appid,
  name,
  genres,
  price: null,
  discount: null,
  coverUrl: null,
  priceValidUntil: 1000,
});

test('explicit genres rank first; each distinct played game casts one vote using its corrected genres', () => {
  const games = [
    makeGame({
      appid: 10,
      name: 'Civilization',
      steamImported: true,
      playtimeMinutes: 45,
      genres: ['action'],
      genresOverride: ['strategy', 'rpg'],
    }),
    makeGame({
      appid: 10,
      name: 'Duplicate',
      steamImported: true,
      playtimeMinutes: 20,
      genres: ['strategy'],
    }),
    makeGame({
      appid: 11,
      name: 'Into the Breach',
      steamImported: true,
      playtimeMinutes: 1,
      genres: ['strategy'],
    }),
    makeGame({ appid: 12, steamImported: false, playtimeMinutes: 80, genres: ['shooter'] }),
    makeGame({ appid: 13, steamImported: true, playtimeMinutes: 0, genres: ['shooter'] }),
  ];
  const candidates = [
    offer(1, 'First', 'strategy', 'rpg'),
    offer(2, 'Next', 'puzzle'),
    offer(3, 'Missing', 'shooter'),
    offer(4, 'Both', 'arcade', 'puzzle'),
  ];
  const picks = rankOffers(candidates, games, playedLibrary(games), ['arcade', 'puzzle'], []);
  expect(picks.map((p) => p.offer.appid)).toEqual([4, 2, 1]);
  expect(picks[0]?.reason).toContain('Вы выбрали');
  expect(picks[2]).toMatchObject({
    votes: 2,
    reason: 'Вы играли в Civilization. Общий жанр — «Стратегии».',
  });
});

test('removes owned and marked IDs before applying the five-card cap, with stable ties', () => {
  const games = [
    makeGame({ appid: 11, steamImported: false }),
    makeGame({ appid: 2_000_000_123, name: 'Same' }),
  ];
  const offers = [11, 12, 13, 8, 2, 3, 3, 5, 7, 10, 1].map((id) =>
    offer(id, id === 1 ? 'Z' : 'Same', 'puzzle'),
  );
  const marks = [{ appid: 12 }, { appid: 13 }];
  const ids = (library: typeof games) =>
    rankOffers(offers, library, [], ['puzzle'], marks).map((p) => p.offer.appid);
  expect(ids(games)).toEqual([2, 3, 5, 7, 8]);
  expect(ids([...games, makeGame({ appid: 2 })])).toEqual([3, 5, 7, 8, 10]);
  expect(rankOffers(offers, [], [], [], [])).toEqual([]);
});

test('account preferences survive reread and concurrent changes, undo and cleanup', async () => {
  await AsyncStorage.clear();
  const revision = accountRevision('A');
  await Promise.all([
    updateSettings('A', revision, (s) => ({ ...s, region: 'RU', genres: ['puzzle'] })),
    updateSettings('A', revision, (s) => ({
      ...s,
      marks: [{ appid: 1, name: 'Portal', kind: 'owned' }],
    })),
  ]);
  expect(await readSettings('A')).toEqual({
    region: 'RU',
    genres: ['puzzle'],
    marks: [{ appid: 1, name: 'Portal', kind: 'owned' }],
  });
  expect((await readSettings('B')).marks).toEqual([]);
  await updateSettings('A', revision, (s) => ({ ...s, marks: [] }));
  expect((await readSettings('A')).marks).toEqual([]);
  await clearAccountData('A');
  expect(await updateSettings('A', revision, (s) => ({ ...s, region: 'US' }))).toBeUndefined();
  expect((await readSettings('A')).region).toBeNull();
});
