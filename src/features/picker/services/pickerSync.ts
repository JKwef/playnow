import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';
import { isRecord } from '@/shared/utils/validation';
import {
  EMPTY_PICKER_SNAPSHOT,
  mergePickerSnapshots,
  parsePickerSnapshot,
  sameSnapshot,
  type PickerSnapshot,
  type PickerSyncRemote,
  type RemotePickerState,
} from '@/features/picker/services/pickerSyncModel';
import { signalPickerChange } from '@/features/picker/services/pickerSyncSignals';

interface Pending {
  id: string;
  revision: number;
  snapshot: PickerSnapshot;
  observed: PickerSnapshot;
  acknowledged: RemotePickerState | null;
}
interface SyncDocument {
  enabled: boolean;
  revision: number | null;
  baseline: PickerSnapshot;
  pending: Pending | null;
}
type Phase = 'loading' | 'disabled' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';
interface SyncState {
  account: string | null;
  document: SyncDocument | null;
  phase: Phase;
  error: string | null;
  lastSyncedAt: string | null;
  conflict: { local: PickerSnapshot; remote: RemotePickerState } | null;
  reset: () => void;
  load: (account: string) => Promise<void>;
  enable: (account: string, enabled: boolean) => Promise<void>;
  sync: (account: string) => Promise<void>;
  resolve: (account: string, version: 'local' | 'remote') => Promise<void>;
}
const keyFor = (account: string) => `playnow:pickerSync:v1:${account}`;
const choiceKey = (account: string) => `playnow:acceptedChoice:v1:${account}`;
const postponedKey = (account: string) => `playnow:blacklist:v1:${account}`;
const initialDocument = (): SyncDocument => ({
  enabled: false,
  revision: null,
  baseline: EMPTY_PICKER_SNAPSHOT,
  pending: null,
});
const validRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const createPickerSyncStore = (
  remote: PickerSyncRemote,
  storage: CacheStorage = AsyncStorage,
  uuid: () => string = randomUUID,
  now: () => number = Date.now,
) => {
  let generation = 0;
  const initial = {
    account: null,
    document: null,
    phase: 'loading' as Phase,
    error: null,
    lastSyncedAt: null,
    conflict: null,
  };
  return create<SyncState>()((set, get) => {
    const local = async (account: string): Promise<PickerSnapshot> => {
      const choice = await storage.getItem(choiceKey(account));
      const postponed = await storage.getItem(postponedKey(account));
      return parsePickerSnapshot(
        {
          choice: choice === null ? null : JSON.parse(choice),
          postponed: postponed === null ? {} : JSON.parse(postponed),
        },
        now(),
      );
    };
    const scope = (account: string) => {
      const request = generation;
      const revision = accountRevision(account);
      return () =>
        generation === request &&
        accountRevision(account) === revision &&
        get().account === account;
    };
    const persist = async (account: string, doc: SyncDocument, current: () => boolean) => {
      await queueAccountWrite(account, async () => {
        if (!current()) return;
        await storage.setItem(keyFor(account), JSON.stringify(doc));
        if (current()) set({ document: doc });
      });
    };
    const readLocal = async (account: string, current: () => boolean) => {
      let result = EMPTY_PICKER_SNAPSHOT;
      await queueAccountWrite(account, async () => {
        if (current()) result = await local(account);
      });
      return result;
    };
    const applyPending = async (
      account: string,
      doc: SyncDocument,
      current: () => boolean,
    ): Promise<boolean> => {
      const pending = doc.pending!;
      const acknowledged = pending.acknowledged!;
      let changed = false;
      let remaining = false;
      let conflicted = false;
      await queueAccountWrite(account, async () => {
        if (!current()) return;
        const here = await local(account);
        const merged = mergePickerSnapshots(
          parsePickerSnapshot(pending.observed, now()),
          here,
          parsePickerSnapshot(acknowledged.snapshot, now()),
        );
        if (!merged) {
          conflicted = true;
          set({ phase: 'conflict', conflict: { local: here, remote: acknowledged }, error: null });
          return;
        }
        changed = !sameSnapshot(here, merged);
        // The durable acknowledged pending item is the recovery journal if either write fails.
        if (changed) {
          if (merged.choice)
            await storage.setItem(choiceKey(account), JSON.stringify(merged.choice));
          else await storage.removeItem(choiceKey(account));
          await storage.setItem(postponedKey(account), JSON.stringify(merged.postponed));
        }
        const next: SyncDocument = {
          ...doc,
          revision: acknowledged.revision,
          baseline: acknowledged.snapshot,
          pending: null,
        };
        await storage.setItem(keyFor(account), JSON.stringify(next));
        remaining = !sameSnapshot(merged, parsePickerSnapshot(acknowledged.snapshot, now()));
        if (current())
          set({
            document: next,
            conflict: null,
            error: null,
            phase: remaining ? 'pending' : 'synced',
            lastSyncedAt: new Date(now()).toISOString(),
          });
      });
      if (changed && current()) signalPickerChange(account, true);
      return !conflicted && remaining;
    };
    const pushPending = async (
      account: string,
      doc: SyncDocument,
      current: () => boolean,
    ): Promise<boolean> => {
      const pending = doc.pending!;
      if (!pending.acknowledged) {
        const response = await remote.write(
          account,
          pending.revision,
          pending.id,
          pending.snapshot,
        );
        if (!current()) return false;
        if (!response.applied) {
          const here = await readLocal(account, current);
          if (current())
            set({ phase: 'conflict', conflict: { local: here, remote: response }, error: null });
          return false;
        }
        doc = { ...doc, pending: { ...pending, acknowledged: response } };
        await persist(account, doc, current);
      }
      if (!current()) return false;
      return applyPending(account, doc, current);
    };
    return {
      ...initial,
      reset: () => {
        generation++;
        set(initial);
      },
      load: async (account) => {
        if (get().account === account && get().document) return;
        const request = ++generation;
        const revision = accountRevision(account);
        set({ ...initial, account });
        const current = () =>
          generation === request &&
          accountRevision(account) === revision &&
          get().account === account;
        try {
          let doc = initialDocument();
          await queueAccountWrite(account, async () => {
            if (!current()) return;
            const raw = await storage.getItem(keyFor(account));
            if (raw !== null) {
              const value: unknown = JSON.parse(raw);
              if (
                !isRecord(value) ||
                typeof value.enabled !== 'boolean' ||
                (value.revision !== null && !validRevision(value.revision))
              )
                throw new Error('Invalid sync cache');
              doc = {
                enabled: value.enabled,
                revision: value.revision,
                baseline: parsePickerSnapshot(value.baseline, 0),
                pending: null,
              };
              if (value.pending !== null) {
                const item = value.pending;
                if (!isRecord(item) || typeof item.id !== 'string' || !validRevision(item.revision))
                  throw new Error('Invalid outbox');
                let acknowledged: RemotePickerState | null = null;
                if (item.acknowledged !== null) {
                  const ack = item.acknowledged;
                  if (
                    !isRecord(ack) ||
                    !validRevision(ack.revision) ||
                    (ack.mutationId !== null && typeof ack.mutationId !== 'string')
                  )
                    throw new Error('Invalid ack');
                  acknowledged = {
                    revision: ack.revision,
                    snapshot: parsePickerSnapshot(ack.snapshot, 0),
                    mutationId: ack.mutationId,
                  };
                }
                doc.pending = {
                  id: item.id,
                  revision: item.revision,
                  snapshot: parsePickerSnapshot(item.snapshot, 0),
                  observed: parsePickerSnapshot(item.observed, 0),
                  acknowledged,
                };
              }
            }
          });
          if (!current()) return;
          set({ document: doc, phase: doc.enabled ? 'pending' : 'disabled' });
          if (doc.enabled) await get().sync(account);
        } catch {
          if (current())
            set({
              phase: 'error',
              error: 'Не удалось прочитать состояние синхронизации. Локальные данные не изменены.',
            });
        }
      },
      enable: async (account, enabled) => {
        if (get().account !== account || !get().document) return;
        generation++;
        const current = scope(account);
        try {
          await persist(account, { ...get().document!, enabled }, current);
          if (!current()) return;
          set({ phase: enabled ? 'pending' : 'disabled', error: null, conflict: null });
          if (enabled) await get().sync(account);
        } catch {
          if (current())
            set({ phase: 'error', error: 'Не удалось сохранить настройку синхронизации.' });
        }
      },
      sync: async (account) => {
        const doc = get().document;
        if (get().account !== account || !doc?.enabled || get().phase === 'syncing') return;
        const current = scope(account);
        set({ phase: 'syncing', error: null });
        try {
          if (doc.pending && get().conflict === null) {
            const remaining = await pushPending(account, doc, current);
            if (remaining && current()) await get().sync(account);
            return;
          }
          const here = await readLocal(account, current);
          const there = await remote.read(account);
          if (!current()) return;
          const base = parsePickerSnapshot(doc.baseline, now());
          const remoteSnapshot = parsePickerSnapshot(there.snapshot, now());
          const merged =
            doc.revision === null &&
            there.revision > 0 &&
            !sameSnapshot(here, EMPTY_PICKER_SNAPSHOT) &&
            !sameSnapshot(here, remoteSnapshot)
              ? null
              : mergePickerSnapshots(base, here, remoteSnapshot);
          if (!merged) {
            set({ phase: 'conflict', conflict: { local: here, remote: there }, error: null });
            return;
          }
          const next: SyncDocument = {
            ...doc,
            pending: {
              id: uuid(),
              revision: there.revision,
              snapshot: merged,
              observed: here,
              acknowledged: sameSnapshot(merged, remoteSnapshot) ? there : null,
            },
          };
          await persist(account, next, current);
          if (!current()) return;
          const remaining = await pushPending(account, next, current);
          if (remaining && current()) await get().sync(account);
        } catch {
          if (current())
            set({
              phase: 'error',
              error:
                'Не удалось синхронизировать. Изменения остаются на устройстве; проверьте сеть и повторите.',
            });
        }
      },
      resolve: async (account, version) => {
        const conflict = get().conflict;
        const doc = get().document;
        if (!conflict || !doc?.enabled || get().account !== account || get().phase === 'syncing')
          return;
        const current = scope(account);
        set({ phase: 'syncing', error: null });
        try {
          const here = await readLocal(account, current);
          const there = await remote.read(account);
          if (!current()) return;
          if (there.revision !== conflict.remote.revision || !sameSnapshot(here, conflict.local)) {
            set({
              phase: 'conflict',
              conflict: { local: here, remote: there },
              error: 'Данные изменились. Проверьте версии и выберите ещё раз.',
            });
            return;
          }
          const snapshot = version === 'local' ? here : parsePickerSnapshot(there.snapshot, now());
          const next: SyncDocument = {
            ...doc,
            pending: {
              id: uuid(),
              revision: there.revision,
              snapshot,
              observed: here,
              acknowledged: version === 'remote' ? there : null,
            },
          };
          await persist(account, next, current);
          if (!current()) return;
          const remaining = await pushPending(account, next, current);
          if (remaining && current()) await get().sync(account);
        } catch {
          if (current())
            set({
              phase: 'error',
              error: 'Не удалось применить выбранную версию. Локальные данные сохранены.',
            });
        }
      },
    };
  });
};
