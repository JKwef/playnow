import AsyncStorage from '@react-native-async-storage/async-storage';

import { invalidateAccount, queueAccountWrite } from '@/shared/services/accountScope';

export interface AccountDataStorage {
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
}

/** Account keys use playnow:<feature>:<version>:<steamId>; theme is device-wide. */
export const clearAccountData = async (
  steamId: string,
  storage: AccountDataStorage = AsyncStorage,
): Promise<void> => {
  invalidateAccount(steamId);
  await queueAccountWrite(steamId, async () => {
    const keys = (await storage.getAllKeys()).filter(
      (key) => key.startsWith('playnow:') && key.endsWith(`:${steamId}`),
    );
    if (keys.length > 0) await storage.multiRemove(keys);
  });
};
