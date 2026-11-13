/** Keep each page below the Data API cap; appid is immutable and unique per account. */
export const LIBRARY_PAGE_SIZE = 500;

/** A real Steam appid alone does not prove ownership or imported playtime. */
export const withSteamImportSource = <T extends { appid: number }>(
  games: T[],
  ownedAppids: ReadonlySet<number>,
): (T & { steam_imported: boolean })[] =>
  games.map((game) => ({ ...game, steam_imported: ownedAppids.has(game.appid) }));

export const readLibrary = async <T extends { appid: number }>(
  fetchPage: (afterAppid: number, limit: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> => {
  const games: T[] = [];
  let cursor = 0;
  for (;;) {
    const { data, error } = await fetchPage(cursor, LIBRARY_PAGE_SIZE);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Missing library page');
    for (const row of data) {
      if (!Number.isSafeInteger(row.appid) || row.appid <= cursor) {
        throw new Error('Library page is not in unique appid order');
      }
      games.push(row);
      cursor = row.appid;
    }
    // An empty page ends iteration even when the server has a smaller configured cap.
    if (data.length === 0) return games;
  }
};
