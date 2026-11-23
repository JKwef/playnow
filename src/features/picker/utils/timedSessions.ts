export interface TimedSession {
  appid: number;
  name: string;
  minutes: number;
  description: string;
  source: string;
}

// Compare the full round or the upper end of the publisher's range with the budget.
export const TIMED_SESSIONS: readonly TimedSession[] = [
  {
    appid: 1966900,
    name: '20 Minutes Till Dawn',
    minutes: 20,
    description: 'По оценке разработчика, один забег занимает от 10 до 20 минут.',
    source: 'https://store.steampowered.com/app/1966900/',
  },
  {
    appid: 1003590,
    name: 'Tetris Effect: Connected',
    minutes: 3,
    description: 'В режиме Ultra таймер одной партии рассчитан на 3 минуты.',
    source: 'https://tetriseffect.game/beginners-community-guide/',
  },
  {
    appid: 609490,
    name: 'Minit',
    minutes: 1,
    description: 'Один игровой день длится 60 секунд. За это время можно сделать одну попытку.',
    source: 'https://store.steampowered.com/app/609490/',
  },
];

export function sessionsWithinBudget(minutes: number, eligible?: ReadonlyMap<number, number>) {
  return TIMED_SESSIONS.filter(
    (session) => session.minutes <= minutes && (!eligible || eligible.has(session.appid)),
  ).sort(
    (a, b) =>
      (eligible?.get(a.appid) ?? 0) - (eligible?.get(b.appid) ?? 0) || b.minutes - a.minutes,
  );
}
