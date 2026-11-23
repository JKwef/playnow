import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { fetchGenreOffers, readOffer } from './catalog.ts';
import { OFFER_TTL_MS } from '../_shared/purchaseCatalog.ts';
const now = 1_800_000;
const option = {
  packageid: 7877,
  included_game_count: 1,
  final_price_in_cents: '999',
  formatted_final_price: '$9.99',
};
const base = {
  id: 620,
  appid: 620,
  item_type: 0,
  type: 0,
  visible: true,
  success: 1,
  name: 'Portal 2',
  tagids: [1664],
  best_purchase_option: option,
};

Deno.test('only visible paid standalone games with a regional package qualify', () => {
  for (const change of [
    { type: 4 },
    { type: 1 },
    { item_type: 2 },
    { success: 15 },
    { visible: false },
    { is_free: true },
    { best_purchase_option: null },
    ...[
      { bundleid: 3 },
      { included_game_count: 2 },
      { final_price_in_cents: '0' },
      { is_free_license: true },
      { must_purchase_as_set: true },
    ].map((p) => ({ best_purchase_option: { ...option, ...p } })),
  ])
    assertEquals(readOffer({ ...base, ...change }, now), null);
  assertEquals(readOffer(base, now)?.genres, ['puzzle']);
  assertEquals(
    readOffer(
      { ...base, best_purchase_option: { packageid: 7877, original_price_in_cents: '999' } },
      now,
    )?.price,
    null,
  );
});
Deno.test(
  'price expires at the earlier of the Steam discount end and five minutes; missing display price has a fallback',
  () => {
    assertEquals(readOffer(base, now)?.priceValidUntil, now + OFFER_TTL_MS);
    const sale = {
      ...option,
      discount_pct: 20,
      active_discounts: [{ discount_end_date: (now + 10_000) / 1000 }],
    };
    const offer = readOffer({ ...base, best_purchase_option: sale }, now);
    assertEquals(offer?.discount, 20);
    assertEquals(offer?.priceValidUntil, now + 10_000);
    assertEquals(
      readOffer(
        { ...base, best_purchase_option: { ...sale, hide_discount_pct_for_compliance: true } },
        now,
      )?.discount,
      null,
    );
    assertEquals(
      readOffer(
        { ...base, best_purchase_option: { ...sale, formatted_final_price: undefined } },
        now,
      )?.price,
      null,
    );
  },
);
Deno.test('search and offer confirmation use the same region and deduplicate app IDs', async () => {
  const urls: URL[] = [];
  const { offers, nextStart } = await fetchGenreOffers('KZ', 'puzzle', 50, async (input) => {
    const url = new URL(input.toString());
    urls.push(url);
    return Response.json(
      url.hostname.startsWith('store.')
        ? { success: 1, total_count: 101, results_html: 'data-ds-appid="620" data-ds-appid="620"' }
        : { response: { store_items: [base, { ...base, appid: 1 }] } },
    );
  });
  assertEquals(
    offers.map((o) => o.appid),
    [620],
  );
  assertEquals(urls[0].searchParams.get('cc'), 'KZ');
  assertEquals(urls[0].searchParams.get('start'), '50');
  assertEquals(nextStart, 100);
  const query = JSON.parse(urls[1].searchParams.get('input_json')!);
  assertEquals(query.context.country_code, 'KZ');
  assertEquals(query.ids, [{ appid: 620 }]);
});
Deno.test('empty and unavailable catalog responses are distinct', async () => {
  assertEquals(
    await fetchGenreOffers('US', 'puzzle', 0, () =>
      Promise.resolve(Response.json({ success: 1, results_html: '', total_count: 0 })),
    ),
    { offers: [], nextStart: null },
  );
  for (const body of [
    { success: 0 },
    { success: 1, results_html: 'unexpected markup', total_count: 3 },
  ]) {
    const error = await assertRejects(() =>
      fetchGenreOffers('US', 'puzzle', 0, () => Promise.resolve(Response.json(body))),
    );
    assert(error instanceof Error);
  }
});
