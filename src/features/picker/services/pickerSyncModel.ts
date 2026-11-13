import { isRecord } from '@/shared/utils/validation';
import { validChoice, type AcceptedChoice } from '@/features/picker/services/acceptedChoice';

export interface PickerSnapshot {
  choice: AcceptedChoice | null;
  postponed: Record<string, number>;
}
export interface RemotePickerState {
  revision: number;
  snapshot: PickerSnapshot;
  mutationId: string | null;
}
export interface PickerSyncRemote {
  read: (account: string) => Promise<RemotePickerState>;
  write: (
    account: string,
    revision: number,
    mutationId: string,
    snapshot: PickerSnapshot,
  ) => Promise<RemotePickerState & { applied: boolean }>;
}
export const EMPTY_PICKER_SNAPSHOT: PickerSnapshot = { choice: null, postponed: {} };
export const parsePickerSnapshot = (value: unknown, now = Date.now()): PickerSnapshot => {
  if (
    !isRecord(value) ||
    (value.choice !== null && !validChoice(value.choice)) ||
    !isRecord(value.postponed)
  )
    throw new Error('Invalid synchronized data');
  const postponed: Record<string, number> = {};
  for (const id of Object.keys(value.postponed).sort((a, b) => Number(a) - Number(b))) {
    const until = value.postponed[id];
    if (
      !/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(Number(id)) ||
      typeof until !== 'number' ||
      !Number.isSafeInteger(until) ||
      until <= 0
    )
      throw new Error('Invalid postponement');
    if (until > now) postponed[id] = until;
  }
  const choice = value.choice;
  return {
    choice:
      choice === null
        ? null
        : {
            game: { appid: choice.game.appid, name: choice.game.name },
            contextId: choice.contextId,
            mode: choice.mode,
            genreFilter: choice.genreFilter,
            acceptedAt: choice.acceptedAt,
            ...(choice.installedOnly ? { installedOnly: true } : {}),
          },
    postponed,
  };
};
export const sameSnapshot = (a: PickerSnapshot, b: PickerSnapshot): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Three-way merge never guesses which conflicting choice or postponement is newer. */
export function mergePickerSnapshots(
  base: PickerSnapshot,
  local: PickerSnapshot,
  remote: PickerSnapshot,
): PickerSnapshot | null {
  const select = <T>(before: T, here: T, there: T): { value: T } | null =>
    same(here, there) || same(there, before)
      ? { value: here }
      : same(here, before)
        ? { value: there }
        : null;
  const choice = select(base.choice, local.choice, remote.choice);
  if (!choice) return null;
  const postponed: Record<string, number> = {};
  for (const id of new Set([
    ...Object.keys(base.postponed),
    ...Object.keys(local.postponed),
    ...Object.keys(remote.postponed),
  ])) {
    const result = select(base.postponed[id], local.postponed[id], remote.postponed[id]);
    if (!result) return null;
    if (result.value !== undefined) postponed[id] = result.value;
  }
  return { choice: choice.value, postponed };
}
