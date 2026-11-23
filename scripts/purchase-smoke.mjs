import assert from 'node:assert/strict';

export async function fulfillCatalog(route) {
  const { region } = route.request().postDataJSON();
  const now = Date.now();
  return route.fulfill({
    json: {
      region,
      checkedAt: now,
      nextStart: null,
      offers: [
        {
          appid: 999,
          name: 'Лабиринт',
          genres: ['puzzle'],
          coverUrl: null,
          discount: null,
          price: region === 'RU' ? '129 руб' : '$3.99',
          priceValidUntil: now + 300_000,
        },
      ],
    },
  });
}

export async function checkPurchasePicks(page) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  const selectRegion = (name) => page.getByRole('radio', { name, exact: true }).click();
  const title = page.getByRole('heading', { name: 'Лабиринт', exact: true });
  await button('Что купить').click();
  await button('Выбрать регион магазина Steam').click();
  await selectRegion('Россия');
  await button('Изменить жанры').click();
  await page.getByRole('checkbox', { name: 'Головоломки', exact: true }).click();
  await button('Готово').click();
  await page.getByText('Вы выбрали жанр «Головоломки».').waitFor();
  await page.getByText('129 руб').waitFor();
  await page.evaluate(() => {
    const open = window.open;
    window.open = (...args) => {
      window.open = open;
      throw new Error(`Test open failure for ${args[0]}`);
    };
  });
  await button('Посмотреть в Steam').click();
  await page.getByText('Не удалось открыть Steam. Попробуйте ещё раз.').waitFor();
  let openedURL;
  await page.context().route('https://store.steampowered.com/app/**', async (route) => {
    openedURL = new URL(route.request().url());
    await route.fulfill({ contentType: 'text/plain', body: 'Steam test page' });
  });
  const popup = page.waitForEvent('popup');
  await button('Посмотреть в Steam').click();
  const steam = await popup;
  await steam.waitForLoadState('domcontentloaded').catch(() => undefined);
  await steam.close();
  assert.equal(openedURL?.pathname, '/app/999/');
  assert.equal(openedURL.searchParams.get('cc'), 'RU');
  await title.waitFor();
  await button('Уже есть').click();
  await title.waitFor({ state: 'hidden' });
  await page.reload();
  await button('Скрытые игры (1)').click();
  await button('Отменить отметку для Лабиринт').click();
  await title.waitFor();
  await button('Регион магазина · Россия').click();
  await page.route('**/steam-catalog', (route) =>
    route.fulfill({ status: 502, json: { error: 'steam_unavailable' } }),
  );
  await selectRegion('США');
  await page.getByText('Каталог Steam сейчас недоступен.').waitFor();
  assert.equal(await page.getByText('129 руб').count(), 0);
  await page.unroute('**/steam-catalog');
  await button('Повторить').click();
  await page.getByText('$3.99').waitFor();
  assert.equal(await page.getByText('129 руб').count(), 0);
  await page.addStyleTag({ content: '[dir="auto"] {font-size:26px !important}' });
  await button('Посмотреть в Steam').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
