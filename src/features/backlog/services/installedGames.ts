import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';

const keyFor = (account: string) => `playnow:installedGames:v1:${account}`;
const validId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
interface InstalledState {
  account: string | null;
  marked: ReadonlySet<number>;
  isReady: boolean;
  pending: number;
  error: string | null;
  reset: () => void;
  load: (account: string, retry?: boolean) => Promise<void>;
  setMarked: (account: string, appid: number, marked: boolean) => Promise<boolean>;
}

export const createInstalledGamesStore = (storage: CacheStorage = AsyncStorage) => {
  let generation = 0;
  const initial = {
    account: null,
    marked: new Set<number>(),
    isReady: false,
    pending: 0,
    error: null,
  };
  return create<InstalledState>()((set, get) => ({
    ...initial,
    reset: () => {
      generation++;
      set(initial);
    },
    load: async (account, retry = false) => {
      if (get().account === account && !retry) return;
      const request = ++generation;
      const revision = accountRevision(account);
      const current = () => generation === request && accountRevision(account) === revision;
      set({ ...initial, account });
      try {
        await queueAccountWrite(account, async () => {
          if (!current()) return;
          const raw = await storage.getItem(keyFor(account));
          const data: unknown = raw === null ? [] : JSON.parse(raw);
          if (!Array.isArray(data) || !data.every(validId))
            throw new Error('Invalid installation marks');
          if (current()) set({ marked: new Set<number>(data), isReady: true });
        });
      } catch {
        if (current())
          set({ error: 'Не удалось прочитать отметки установки. Повторите загрузку.' });
      }
    },
    setMarked: async (account, appid, marked) => {
      if (
        !validId(appid) ||
        typeof marked !== 'boolean' ||
        get().account !== account ||
        !get().isReady
      )
        return false;
      const request = generation;
      const revision = accountRevision(account);
      const current = () =>
        generation === request &&
        accountRevision(account) === revision &&
        get().account === account;
      let saved = false;
      set({ pending: get().pending + 1, error: null });
      try {
        await queueAccountWrite(account, async () => {
          if (!current()) return;
          const values = new Set(get().marked);
          if (marked) values.add(appid);
          else values.delete(appid);
          await storage.setItem(keyFor(account), JSON.stringify([...values].sort((a, b) => a - b)));
          if (current()) {
            set({ marked: values });
            saved = true;
          }
        });
      } catch {
        if (current()) set({ error: 'Не удалось сохранить отметку установки. Повторите попытку.' });
      } finally {
        if (current()) set({ pending: get().pending - 1 });
      }
      return saved;
    },
  }));
};
