/** Invalidates work even if the same account signs in again before a request finishes. */
const revisions = new Map<string, number>();
const writes = new Map<string, Promise<void>>();

export const accountRevision = (steamId: string): number => revisions.get(steamId) ?? 0;

export const invalidateAccount = (steamId: string): void => {
  revisions.set(steamId, accountRevision(steamId) + 1);
};

/** Clear must follow any already-started disk write, across service instances. */
export const queueAccountWrite = (
  steamId: string,
  operation: () => Promise<void>,
): Promise<void> => {
  const next = (writes.get(steamId) ?? Promise.resolve()).catch(() => undefined).then(operation);
  writes.set(steamId, next);
  void next
    .finally(() => {
      if (writes.get(steamId) === next) writes.delete(steamId);
    })
    .catch(() => undefined);
  return next;
};
