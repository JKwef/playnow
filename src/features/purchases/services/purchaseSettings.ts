import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';
import { isRecord, asPositiveInt } from '@/shared/utils/validation';
import { isStoreGenre, isStoreRegion, type StoreGenre, type StoreRegion } from '../catalog';

export type PurchaseMark = { appid: number; name: string; kind: 'owned' | 'uninterested' };
export interface PurchaseSettings {
  region: StoreRegion | null;
  genres: StoreGenre[];
  marks: PurchaseMark[];
}
const settingsKey = (account: string) => `playnow:purchase:v1:${account}`;
const validMark = (value: unknown): value is PurchaseMark =>
  isRecord(value) &&
  asPositiveInt(value.appid) !== null &&
  typeof value.name === 'string' &&
  (value.kind === 'owned' || value.kind === 'uninterested');

export async function readSettings(account: string): Promise<PurchaseSettings> {
  const raw = await AsyncStorage.getItem(settingsKey(account));
  if (raw === null) return { region: null, genres: [], marks: [] };
  const data: unknown = JSON.parse(raw);
  if (
    !isRecord(data) ||
    !(data.region === null || isStoreRegion(data.region)) ||
    !Array.isArray(data.genres) ||
    !data.genres.every(isStoreGenre) ||
    !Array.isArray(data.marks) ||
    !data.marks.every(validMark)
  )
    throw new Error('Invalid purchase settings');
  return { region: data.region, genres: data.genres, marks: data.marks };
}

export async function updateSettings(
  account: string,
  revision: number,
  change: (current: PurchaseSettings) => PurchaseSettings,
) {
  let saved: PurchaseSettings | undefined;
  await queueAccountWrite(account, async () => {
    if (accountRevision(account) !== revision) return;
    const current = await readSettings(account);
    if (accountRevision(account) !== revision) return;
    const next = change(current);
    await AsyncStorage.setItem(settingsKey(account), JSON.stringify(next));
    if (accountRevision(account) === revision) saved = next;
  });
  return saved;
}
