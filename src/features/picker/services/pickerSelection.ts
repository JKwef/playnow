import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';
import { isRecord } from '@/shared/utils/validation';

import { isPickerMode, type ContextId, type PickerMode } from '../types';
import { isContextId } from '../utils/contexts';

export interface PickerSelection {
  mode: PickerMode;
  contextId: ContextId;
}
export const DEFAULT_PICKER_SELECTION: PickerSelection = {
  mode: 'new',
  contextId: 'short-session',
};
interface SelectionState {
  account: string | null;
  selection: PickerSelection;
  isReady: boolean;
  error: string | null;
  load: (steamId: string) => Promise<void>;
  change: (steamId: string, patch: Partial<PickerSelection>) => Promise<void>;
  reset: () => void;
}
const keyFor = (steamId: string) => `playnow:pickerSelection:v1:${steamId}`;

export const createPickerSelectionStore = (storage: CacheStorage = AsyncStorage) => {
  let operation = 0;
  return create<SelectionState>()((set, get) => ({
    account: null,
    selection: DEFAULT_PICKER_SELECTION,
    isReady: false,
    error: null,
    reset: () => {
      operation++;
      set({ account: null, selection: DEFAULT_PICKER_SELECTION, isReady: false, error: null });
    },
    load: async (steamId) => {
      if (get().account === steamId) return;
      const request = ++operation;
      const revision = accountRevision(steamId);
      set({ account: steamId, selection: DEFAULT_PICKER_SELECTION, isReady: false, error: null });
      let selection = DEFAULT_PICKER_SELECTION;
      let error: string | null = null;
      try {
        const raw = await storage.getItem(keyFor(steamId));
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (
            isRecord(parsed) &&
            isPickerMode(parsed.mode) &&
            typeof parsed.contextId === 'string' &&
            isContextId(parsed.contextId)
          )
            selection = { mode: parsed.mode, contextId: parsed.contextId };
          else error = 'Сохранённые настройки подбора недоступны. Выбран режим «Новое».';
        }
      } catch {
        error = 'Не удалось восстановить настройки подбора. Выбран режим «Новое».';
      }
      if (operation === request && accountRevision(steamId) === revision)
        set({ selection, isReady: true, error });
    },
    change: async (steamId, patch) => {
      if (get().account !== steamId || !get().isReady) return;
      const selection = { ...get().selection, ...patch };
      if (!isPickerMode(selection.mode) || !isContextId(selection.contextId)) return;
      const request = ++operation;
      const revision = accountRevision(steamId);
      set({ selection, error: null });
      try {
        await queueAccountWrite(steamId, async () => {
          if (
            operation === request &&
            accountRevision(steamId) === revision &&
            get().account === steamId
          )
            await storage.setItem(keyFor(steamId), JSON.stringify(selection));
        });
      } catch {
        if (operation === request && accountRevision(steamId) === revision)
          set({ error: 'Выбор применён, но сохранить настройки на устройстве не удалось.' });
      }
    },
  }));
};
