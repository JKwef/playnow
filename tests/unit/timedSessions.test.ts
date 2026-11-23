import { sessionsWithinBudget } from '@/features/picker/utils/timedSessions';

const ids = (budget: number, eligible?: ReadonlyMap<number, number>) =>
  sessionsWithinBudget(budget, eligible).map((game) => game.appid);

test('uses the whole timed activity, including the upper end of an estimated range', () => {
  expect(ids(0)).toEqual([]);
  expect(ids(1)).toEqual([609490]);
  expect(ids(3)).toEqual([1003590, 609490]);
  expect(ids(19)).not.toContain(1966900);
  expect(ids(20)).toEqual([1966900, 1003590, 609490]);
});

test('an empty or unrelated library has no demo fallback and explicit mode priority remains first', () => {
  expect(ids(30, new Map())).toEqual([]);
  expect(ids(30, new Map([[42, 0]]))).toEqual([]);
  expect(
    ids(
      30,
      new Map([
        [609490, 0],
        [1966900, 1],
      ]),
    ),
  ).toEqual([609490, 1966900]);
});
