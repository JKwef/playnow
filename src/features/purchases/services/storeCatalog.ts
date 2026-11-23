import { getFunctionsDeps } from '@/features/backlog/services/defaultServices';
import { callFunction } from '@/features/backlog/services/functionsClient';
import { createFetchWithTimeout } from '@/shared/services/http';
import { asPositiveInt, isRecord } from '@/shared/utils/validation';
import { isStoreGenre, type StoreOffer, type StoreGenre, type StoreRegion } from '../catalog';

function validOffer(value: unknown): value is StoreOffer {
  return (
    isRecord(value) &&
    asPositiveInt(value.appid) !== null &&
    typeof value.name === 'string' &&
    Array.isArray(value.genres) &&
    value.genres.length > 0 &&
    value.genres.every(isStoreGenre) &&
    (value.price === null || typeof value.price === 'string') &&
    (value.coverUrl === null ||
      (typeof value.coverUrl === 'string' && value.coverUrl.startsWith('https://'))) &&
    (value.discount === null || asPositiveInt(value.discount) !== null) &&
    typeof value.priceValidUntil === 'number' &&
    Number.isFinite(value.priceValidUntil)
  );
}

interface GenrePage {
  genre: StoreGenre;
  start: number;
}

async function loadOffers(region: StoreRegion, { genre, start }: GenrePage, signal: AbortSignal) {
  const requestedAt = Date.now();
  const data = await callFunction(
    { ...getFunctionsDeps(), fetch: createFetchWithTimeout(30_000) },
    'steam-catalog',
    signal,
    { region, genre, start },
  );
  if (
    data.region !== region ||
    !(
      data.nextStart === null ||
      (typeof data.nextStart === 'number' &&
        Number.isSafeInteger(data.nextStart) &&
        data.nextStart > start)
    ) ||
    !Array.isArray(data.offers) ||
    !data.offers.every(validOffer) ||
    typeof data.checkedAt !== 'number' ||
    !Number.isFinite(data.checkedAt)
  )
    throw new Error('Invalid regional catalog');
  // Convert the server deadline to the device clock, conservatively including the round trip.
  const checkedAt = data.checkedAt;
  const offers = data.offers.map((offer) => ({
    ...offer,
    priceValidUntil: requestedAt + (offer.priceValidUntil - checkedAt),
  }));
  return { offers, next: data.nextStart === null ? [] : [{ genre, start: data.nextStart }] };
}

export async function loadCatalogPage(
  region: StoreRegion,
  cursors: GenrePage[],
  signal: AbortSignal,
) {
  const offers: StoreOffer[] = [];
  const next: GenrePage[] = [];
  for (let offset = 0; offset < cursors.length; offset += 3) {
    signal.throwIfAborted();
    const pages = await Promise.all(
      cursors.slice(offset, offset + 3).map((cursor) => loadOffers(region, cursor, signal)),
    );
    for (const page of pages) {
      offers.push(...page.offers);
      next.push(...page.next);
    }
  }
  return { offers, next };
}
