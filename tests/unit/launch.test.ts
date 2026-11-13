import { assertEquals, assertRejects } from './helpers/assert';
import {
  createSteamLauncher,
  LaunchError,
  steamRunUrl,
  LAUNCH_ERROR_MESSAGES,
} from '@/features/launch/services/steamLauncher';
import { createBlacklistService } from '@/features/picker/services/blacklist';
import { formatPostponedUntil } from '@/features/picker/utils/postponed';

test('launcher opens steam://run/<appid>', async () => {
  const opened: string[] = [];
  await createSteamLauncher({
    openURL: (u) => {
      opened.push(u);
      return Promise.resolve(true);
    },
  }).launch(620);
  assertEquals(opened, ['steam://run/620']);
  assertEquals(steamRunUrl(1), 'steam://run/1');
});
test('launcher: not installed and manual game', async () => {
  const e = await assertRejects(
    () =>
      createSteamLauncher({ openURL: () => Promise.reject(new Error('No Activity found')) }).launch(
        620,
      ),
    LaunchError,
  );
  assertEquals((e as LaunchError).code, 'steam_not_installed');
  assertEquals(
    LAUNCH_ERROR_MESSAGES.steam_not_installed,
    'Steam не установлен. Установите Steam и попробуйте снова',
  );
  let called = false;
  const m = await assertRejects(
    () =>
      createSteamLauncher({
        openURL: () => {
          called = true;
          return Promise.resolve();
        },
      }).launch(2_000_000_005),
    LaunchError,
  );
  assertEquals([(m as LaunchError).code, called], ['manual_game', false]);
});
test('blacklist remove', async () => {
  const mem = new Map<string, string>();
  const st = {
    getItem: (k: string) => Promise.resolve(mem.get(k) ?? null),
    setItem: (k: string, v: string) => {
      mem.set(k, v);
      return Promise.resolve();
    },
    removeItem: (k: string) => {
      mem.delete(k);
      return Promise.resolve();
    },
  };
  const svc = createBlacklistService(st, () => 1000);
  await svc.add('A', 1);
  await svc.add('A', 2);
  assertEquals([...(await svc.remove('A', 1)).keys()], [2]);
  assertEquals([...(await svc.read('A')).keys()], [2]);
});
test('formatPostponedUntil', () => {
  const now = Date.UTC(2026, 10, 1, 12);
  assertEquals(formatPostponedUntil(now + 7 * 86400000, now).endsWith('ещё 7 дн.'), true);
  assertEquals(formatPostponedUntil(now + 1000, now).endsWith('ещё 1 дн.'), true);
});
