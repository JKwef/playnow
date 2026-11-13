import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';
import { isRecord } from '@/shared/utils/validation';
import { isPickerMode, type ContextId, type GenreFilter, type PickerMode } from '../types';
import { isContextId } from '../utils/contexts';
import { signalPickerChange } from '@/features/picker/services/pickerSyncSignals';

export interface AcceptedChoice {
  game: { appid: number; name: string };
  contextId: ContextId;
  mode: PickerMode;
  genreFilter: GenreFilter;
  acceptedAt: string;
  installedOnly?: boolean;
}
export type ChoiceInput = Omit<AcceptedChoice, 'acceptedAt'>;
interface ChoiceState {
  account: string | null;
  choice: AcceptedChoice | null;
  previous: AcceptedChoice | null;
  canUndo: boolean;
  isReady: boolean;
  isSaving: boolean;
  error: string | null;
  load: (account: string) => Promise<void>;
  accept: (account: string, input: ChoiceInput) => Promise<boolean>;
  undo: (account: string) => Promise<boolean>;
  reset: () => void;
}
const keyFor = (account: string) => `playnow:acceptedChoice:v1:${account}`;
export const validChoice = (value: unknown): value is AcceptedChoice =>
  isRecord(value) &&
  isRecord(value.game) &&
  Number.isSafeInteger(value.game.appid) &&
  Number(value.game.appid) > 0 &&
  typeof value.game.name === 'string' &&
  value.game.name.trim().length > 0 &&
  typeof value.contextId === 'string' &&
  isContextId(value.contextId) &&
  isPickerMode(value.mode) &&
  (value.genreFilter === 'context' || value.genreFilter === 'any') &&
  (value.installedOnly === undefined || typeof value.installedOnly === 'boolean') &&
  typeof value.acceptedAt === 'string' &&
  Number.isFinite(Date.parse(value.acceptedAt));

export const createAcceptedChoiceStore = (
  storage: CacheStorage = AsyncStorage,
  now: () => Date = () => new Date(),
) => {
  let generation = 0;
  const initial = {
    account: null,
    choice: null,
    previous: null,
    canUndo: false,
    isReady: false,
    isSaving: false,
    error: null,
  };
  return create<ChoiceState>()((set, get) => {
    const write = async (
      account: string,
      choice: AcceptedChoice | null,
      undo: boolean,
    ): Promise<boolean> => {
      const before = get();
      if (before.account !== account || !before.isReady || before.isSaving) return false;
      const request = generation;
      const revision = accountRevision(account);
      const current = () =>
        request === generation &&
        revision === accountRevision(account) &&
        get().account === account;
      set({ isSaving: true, error: null });
      try {
        await queueAccountWrite(account, async () => {
          if (!current()) return;
          if (choice) await storage.setItem(keyFor(account), JSON.stringify(choice));
          else await storage.removeItem(keyFor(account));
        });
        if (!current()) return false;
        set({ choice, previous: undo ? null : before.choice, canUndo: !undo, isSaving: false });
        signalPickerChange(account);
        return true;
      } catch {
        if (current())
          set({
            isSaving: false,
            error: undo
              ? 'Не удалось отменить выбор. Попробуйте ещё раз.'
              : 'Не удалось сохранить выбор на устройстве. Попробуйте ещё раз.',
          });
        return false;
      }
    };
    return {
      ...initial,
      reset: () => {
        generation++;
        set(initial);
      },
      load: async (account) => {
        if (get().account === account) return;
        const request = ++generation;
        const revision = accountRevision(account);
        set({ ...initial, account });
        try {
          let raw: string | null = null;
          await queueAccountWrite(account, async () => {
            raw = await storage.getItem(keyFor(account));
          });
          const choice: unknown = raw === null ? null : JSON.parse(raw);
          if (choice !== null && !validChoice(choice)) throw new Error('Invalid choice');
          if (generation === request && accountRevision(account) === revision)
            set({ choice, isReady: true });
        } catch {
          if (generation === request && accountRevision(account) === revision)
            set({ error: 'Не удалось прочитать сохранённый выбор. Повторите загрузку.' });
        }
      },
      accept: (account, input) => {
        const choice = { ...input, game: { ...input.game }, acceptedAt: now().toISOString() };
        return validChoice(choice) ? write(account, choice, false) : Promise.resolve(false);
      },
      undo: (account) =>
        get().canUndo ? write(account, get().previous, true) : Promise.resolve(false),
    };
  });
};
