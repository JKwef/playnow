import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';
import { isRecord } from '@/shared/utils/validation';
import { isContextId } from '@/features/picker/utils/contexts';
import { isPickerMode } from '@/features/picker/types';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';
import { isRefusalReason, type RefusalReason } from '@/features/picker/types/refusal';

export const HISTORY_LIMIT = 20;
export type Recommendation = ChoiceInput & {
  shownAt: string;
  refusal?: { reason: RefusalReason; savedAt: string };
};
export const recommendationId = (item: ChoiceInput): string =>
  `${item.game.appid}:${item.contextId}:${item.mode}:${item.genreFilter}${item.installedOnly ? ':installed' : ''}`;
const keyFor = (account: string) => `playnow:recommendationHistory:v1:${account}`;

const validInput = (value: unknown): value is ChoiceInput =>
  isRecord(value) &&
  isRecord(value.game) &&
  Number.isSafeInteger(value.game.appid) &&
  Number(value.game.appid) > 0 &&
  typeof value.game.name === 'string' &&
  value.game.name.trim().length > 0 &&
  value.game.name.length <= 500 &&
  typeof value.contextId === 'string' &&
  isContextId(value.contextId) &&
  isPickerMode(value.mode) &&
  (value.installedOnly === undefined || typeof value.installedOnly === 'boolean') &&
  (value.genreFilter === 'any' || value.genreFilter === 'context');

interface HistoryState {
  account: string | null;
  entries: readonly Recommendation[];
  isReady: boolean;
  pending: number;
  error: string | null;
  reset: () => void;
  load: (account: string, retry?: boolean) => Promise<void>;
  record: (account: string, input: ChoiceInput) => Promise<boolean>;
  clear: (account: string) => Promise<boolean>;
  setRefusal: (account: string, id: string, reason: RefusalReason | null) => Promise<boolean>;
}

export const createRecommendationHistoryStore = (
  storage: CacheStorage = AsyncStorage,
  now: () => Date = () => new Date(),
) => {
  let generation = 0;
  const initial = { account: null, entries: [], isReady: false, pending: 0, error: null };
  return create<HistoryState>()((set, get) => {
    const update = async (
      account: string,
      input: ChoiceInput | null,
      feedback?: { id: string; reason: RefusalReason | null },
    ) => {
      const requiresReady = input !== null || feedback !== undefined;
      if (get().account !== account || (requiresReady && !get().isReady && get().error !== null))
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
          if (!current() || (requiresReady && !get().isReady)) return;
          const previousRefusal = input
            ? get().entries.find((item) => recommendationId(item) === recommendationId(input))
                ?.refusal
            : undefined;
          const entry = input
            ? {
                ...input,
                game: { ...input.game },
                shownAt: now().toISOString(),
                ...(previousRefusal ? { refusal: previousRefusal } : {}),
              }
            : null;
          let entries: readonly Recommendation[] = entry
            ? [
                entry,
                ...get().entries.filter(
                  (item) => recommendationId(item) !== recommendationId(entry),
                ),
              ].slice(0, HISTORY_LIMIT)
            : [];
          if (feedback) {
            if (!get().entries.some((item) => recommendationId(item) === feedback.id)) {
              set({ error: 'Рекомендации уже нет в истории. Причина не сохранена.' });
              return;
            }
            entries = get().entries.map((item) => {
              if (recommendationId(item) !== feedback.id) return item;
              const { refusal: _previous, ...snapshot } = item;
              return feedback.reason === null
                ? snapshot
                : {
                    ...snapshot,
                    refusal: { reason: feedback.reason, savedAt: now().toISOString() },
                  };
            });
          }
          if (entry || feedback) await storage.setItem(keyFor(account), JSON.stringify(entries));
          else await storage.removeItem(keyFor(account));
          if (current()) {
            set({ entries, isReady: true });
            saved = true;
          }
        });
      } catch {
        if (current())
          set({
            error: feedback
              ? 'Не удалось сохранить изменение причины отказа. Повторите попытку.'
              : input
                ? 'Не удалось сохранить рекомендацию в историю. Повторите попытку.'
                : 'Не удалось очистить историю. Повторите попытку.',
          });
      } finally {
        if (current()) set({ pending: get().pending - 1 });
      }
      return saved;
    };
    return {
      ...initial,
      reset: () => {
        generation++;
        set(initial);
      },
      load: async (account, retry = false) => {
        if (get().account === account && !retry) return;
        const request = ++generation;
        const revision = accountRevision(account);
        set({ ...initial, account });
        const current = () => generation === request && accountRevision(account) === revision;
        try {
          await queueAccountWrite(account, async () => {
            if (!current()) return;
            const raw = await storage.getItem(keyFor(account));
            const parsed: unknown = raw === null ? [] : JSON.parse(raw);
            if (
              !Array.isArray(parsed) ||
              !parsed.every(
                (item) =>
                  isRecord(item) &&
                  typeof item.shownAt === 'string' &&
                  Number.isFinite(Date.parse(item.shownAt)) &&
                  (item.refusal === undefined ||
                    (isRecord(item.refusal) &&
                      isRefusalReason(item.refusal.reason) &&
                      typeof item.refusal.savedAt === 'string' &&
                      Number.isFinite(Date.parse(item.refusal.savedAt)))) &&
                  validInput(item),
              )
            )
              throw new Error('Invalid history');
            const seen = new Set<string>();
            const entries = (parsed as Recommendation[])
              .filter((item) => {
                const id = recommendationId(item);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              })
              .slice(0, HISTORY_LIMIT);
            if (current()) set({ entries, isReady: true });
          });
        } catch {
          if (current())
            set({
              error: 'Не удалось прочитать историю. Повторите загрузку или явно очистите её.',
            });
        }
      },
      record: (account, input) =>
        validInput(input)
          ? update(account, { ...input, game: { ...input.game } })
          : Promise.resolve(false),
      clear: (account) => update(account, null),
      setRefusal: (account, id, reason) =>
        reason === null || isRefusalReason(reason)
          ? update(account, null, { id, reason })
          : Promise.resolve(false),
    };
  });
};
