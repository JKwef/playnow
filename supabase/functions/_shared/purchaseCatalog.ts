// Shared wire contract for the Edge Function and the mobile app.
export const STORE_TAGS = {
  action: 19,
  adventure: 21,
  arcade: 1773,
  board: 1770,
  card: 1666,
  casual: 597,
  educational: 1036,
  family: 5350,
  fighting: 1743,
  indie: 492,
  mmo: 128,
  narrative: 1742,
  platformer: 1625,
  puzzle: 1664,
  racing: 699,
  roguelike: 1716,
  rpg: 122,
  shooter: 1774,
  simulation: 599,
  sports: 701,
  strategy: 9,
} as const;
export type StoreGenre = keyof typeof STORE_TAGS;
export const isStoreGenre = (value: unknown): value is StoreGenre =>
  typeof value === 'string' && Object.hasOwn(STORE_TAGS, value);

export const STORE_REGIONS = {
  RU: 'Россия',
  KZ: 'Казахстан',
  UA: 'Украина',
  AM: 'Армения',
  GE: 'Грузия',
  UZ: 'Узбекистан',
  KG: 'Кыргызстан',
  AZ: 'Азербайджан',
  MD: 'Молдова',
  BY: 'Беларусь',
  US: 'США',
  CA: 'Канада',
  GB: 'Великобритания',
  DE: 'Германия',
  FR: 'Франция',
  PL: 'Польша',
  TR: 'Турция',
  NL: 'Нидерланды',
  ES: 'Испания',
  IT: 'Италия',
  FI: 'Финляндия',
  RS: 'Сербия',
  BR: 'Бразилия',
  AR: 'Аргентина',
  MX: 'Мексика',
  JP: 'Япония',
  CN: 'Китай',
  IN: 'Индия',
  AU: 'Австралия',
  KR: 'Южная Корея',
} as const;
export type StoreRegion = keyof typeof STORE_REGIONS;
export const isStoreRegion = (value: unknown): value is StoreRegion =>
  typeof value === 'string' && Object.hasOwn(STORE_REGIONS, value);
export const OFFER_TTL_MS = 5 * 60 * 1000;

export interface StoreOffer {
  appid: number;
  name: string;
  genres: StoreGenre[];
  coverUrl: string | null;
  price: string | null;
  discount: number | null;
  priceValidUntil: number;
}
