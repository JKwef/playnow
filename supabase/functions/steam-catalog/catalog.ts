import {
  OFFER_TTL_MS,
  STORE_TAGS,
  type StoreGenre,
  type StoreOffer,
  type StoreRegion,
} from '../_shared/purchaseCatalog.ts';
import { UPSTREAM_TIMEOUT_MS } from '../_shared/http.ts';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function readOffer(value: unknown, now: number): StoreOffer | null {
  if (
    !record(value) ||
    value.success !== 1 ||
    value.visible !== true ||
    value.item_type !== 0 ||
    value.type !== 0 ||
    value.is_free ||
    !positive(value.appid) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !Array.isArray(value.tagids)
  )
    return null;
  const option = value.best_purchase_option;
  if (
    !record(option) ||
    !positive(option.packageid) ||
    option.bundleid ||
    option.must_purchase_as_set ||
    option.is_free_to_keep ||
    option.is_free_license ||
    option.is_commercial_license ||
    option.recurrence_info ||
    (option.included_game_count ?? 1) !== 1
  )
    return null;
  // A confirmed paid package can lack a display price. An explicit zero is a free offer.
  const finalAmount = option.final_price_in_cents;
  const paidAmount = Number(finalAmount ?? option.original_price_in_cents);
  if (!Number.isSafeInteger(paidAmount) || paidAmount <= 0 || option.discount_pct === 100)
    return null;
  const genres = (Object.keys(STORE_TAGS) as StoreGenre[]).filter((key) =>
    (value.tagids as unknown[]).includes(STORE_TAGS[key]),
  );
  if (!genres.length) return null;
  const assets = value.assets;
  const coverUrl =
    record(assets) &&
    typeof assets.header === 'string' &&
    /^[\w./-]+$/.test(assets.header) &&
    typeof assets.asset_url_format === 'string' &&
    assets.asset_url_format.startsWith(`steam/apps/${value.appid}/`) &&
    assets.asset_url_format.includes('${FILENAME}')
      ? 'https://shared.fastly.steamstatic.com/store_item_assets/' +
        assets.asset_url_format.replace('${FILENAME}', assets.header)
      : null;
  const ends = Array.isArray(option.active_discounts)
    ? option.active_discounts.flatMap((d) =>
        record(d) && positive(d.discount_end_date) ? [d.discount_end_date * 1000] : [],
      )
    : [];
  const priceValidUntil = Math.min(now + OFFER_TTL_MS, ...ends);
  const price =
    finalAmount != null &&
    typeof option.formatted_final_price === 'string' &&
    option.formatted_final_price.trim()
      ? option.formatted_final_price
      : null;
  const discount =
    price &&
    !option.hide_discount_pct_for_compliance &&
    !option.should_suppress_discount_pct &&
    !option.price_cannot_be_displayed_as_discount &&
    positive(option.discount_pct) &&
    option.discount_pct < 100
      ? option.discount_pct
      : null;
  return {
    appid: value.appid,
    name: value.name,
    genres,
    coverUrl,
    price,
    discount,
    priceValidUntil,
  };
}

export async function fetchGenreOffers(
  region: StoreRegion,
  genre: StoreGenre,
  start: number,
  request = fetch,
) {
  const pageSize = 50;
  const readJson = async (url: URL) => {
    const response = await request(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!response.ok) throw new Error('Steam catalog unavailable');
    return (await response.json()) as unknown;
  };
  const search = new URL('https://store.steampowered.com/search/results/');
  search.search = new URLSearchParams({
    infinite: '1',
    tags: String(STORE_TAGS[genre]),
    category1: '998',
    hidef2p: '1',
    start: String(start),
    count: String(pageSize),
    cc: region,
    l: 'english',
  }).toString();
  const page = await readJson(search);
  if (!record(page) || page.success !== 1 || typeof page.results_html !== 'string')
    throw new Error('Invalid store search');
  const ids = [
    ...new Set(
      Array.from(page.results_html.matchAll(/data-ds-appid="(\d+)"/g), (m) => Number(m[1])),
    ),
  ].slice(0, pageSize);
  const total = Number(page.total_count);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid store count');
  const nextStart = start + pageSize < total ? start + pageSize : null;
  if (!ids.length) {
    if (start >= total || /data-ds-(?:bundleid|packageid)=/.test(page.results_html))
      return { offers: [], nextStart };
    throw new Error('Invalid store search results');
  }
  const url = new URL('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/');
  url.searchParams.set(
    'input_json',
    JSON.stringify({
      ids: ids.map((appid) => ({ appid })),
      context: { country_code: region, language: 'english' },
      data_request: { include_assets: true, include_tag_count: 20 },
    }),
  );
  const payload = await readJson(url);
  if (!record(payload) || !record(payload.response) || !Array.isArray(payload.response.store_items))
    throw new Error('Invalid store offers');
  const now = Date.now();
  const offers = payload.response.store_items
    .map((item) => readOffer(item, now))
    .filter((offer): offer is StoreOffer => offer !== null && ids.includes(offer.appid));
  return { offers, nextStart };
}
