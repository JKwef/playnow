import { explainPick } from '@/features/picker/utils/explainPick';
import { findContext } from '@/features/picker/utils/contexts';
import { parseGameRow, toGameRow } from '@/features/backlog/services/parseGames';
import { mergeGames } from '@/features/backlog/services/rawgApi';

import { makeGame } from './fixtures/game';

const context = findContext('action')!;

test('explicit status explains the actual mode instead of inferring from Steam time', () => {
  const fresh = explainPick(
    makeGame({ genres: ['action'], playtimeMinutes: 900, steamImported: true }),
    context,
    'new',
    { progressStatus: 'not_started', excluded: false },
  );
  expect(fresh[0]).toContain('Не начинал');
  expect(fresh[0]).toContain('Новое');
  const continuing = explainPick(
    makeGame({ genres: ['action'], steamImported: true }),
    context,
    'continue',
    { progressStatus: 'playing', excluded: false },
  );
  expect(continuing[0]).toContain('Играю');
  expect(continuing[0]).not.toContain('нулю');
});

test('only a confirmed Steam import is described as Steam history', () => {
  for (const steamImported of [undefined, false, true]) {
    const reasons = explainPick(
      makeGame({ genres: ['action'], playtimeMinutes: 61, steamImported }),
      context,
      'continue',
    );
    expect(reasons.join(' ').includes('истории Steam')).toBe(steamImported === true);
  }
  expect(
    explainPick(makeGame({ appid: 2_000_000_001, steamImported: true }), context, 'new').join(' '),
  ).not.toContain('Steam');
});

test('relaxation is explained and never claims that missing genres matched the context', () => {
  const reasons = explainPick(makeGame({ genres: [] }), context, 'new', undefined, true);
  expect(reasons.join(' ')).toContain('Фильтр жанров отключён');
  expect(reasons.join(' ')).not.toContain('Подходит по жанрам');
  expect(reasons.join(' ')).not.toContain('вкусу');
});

test('manual genre corrections explain the criteria actually used', () => {
  const reasons = explainPick(
    makeGame({ genres: ['action'], genresOverride: ['action'] }),
    context,
    'new',
  );
  expect(reasons.join(' ')).toContain('Указанные вами жанры');
  expect(reasons.join(' ')).toContain('Экшен');
});

test('Steam source proof survives serialization and metadata enrichment', () => {
  const game = makeGame({ genres: ['action'], steamImported: true });
  expect(parseGameRow(toGameRow(game))?.steamImported).toBe(true);
  expect(
    mergeGames({ games: [game], updatedAt: 'date' }, [makeGame({ genres: ['action', 'shooter'] })])
      .games[0]?.steamImported,
  ).toBe(true);
});
