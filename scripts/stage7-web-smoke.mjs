import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { checkPurchasePicks, fulfillCatalog } from './purchase-smoke.mjs';
import { checkSessionTimeAndSearch } from './session-time-smoke.mjs';

// Run against an exported build, with isolated synthetic accounts and no live API traffic.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dist = resolve(process.argv[2] || '.tools/stage7-web');
const stabilityChecks = process.argv.includes('--stability');
const refusalChecks = process.argv.includes('--refusals');
const installationChecks = process.argv.includes('--installed');
const purchaseChecks = process.argv.includes('--purchases');
const historyChecks =
  process.argv.includes('--history') || stabilityChecks || refusalChecks || installationChecks;
const artifacts = resolve(
  purchaseChecks
    ? '.tools/purchase-qa'
    : installationChecks
      ? '.tools/stage11-qa'
      : refusalChecks
        ? '.tools/stage10-qa'
        : stabilityChecks
          ? '.tools/stage9-qa'
          : historyChecks
            ? '.tools/stage8-qa'
            : '.tools/stage7-qa',
);
await stat(resolve(dist, 'index.html'));
await mkdir(artifacts, { recursive: true });
const bundles = await Promise.all(
  (await readdir(resolve(dist, '_expo/static/js/web')))
    .filter((name) => name.endsWith('.js'))
    .map(async (name) => ({
      file: name,
      sha256: createHash('sha256')
        .update(await readFile(resolve(dist, '_expo/static/js/web', name)))
        .digest('hex'),
    })),
);
const config = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const apiOrigin = new URL(config.expo.extra.supabaseUrl).origin;
const authKey = `sb-${new URL(apiOrigin).hostname.split('.')[0]}-auth-token`;
const account = '76561197960287930';
const choiceKey = `playnow:acceptedChoice:v1:${account}`;
const rows = [
  { appid: 620, name: 'Portal 2', genres: ['puzzle', 'adventure'], playtime: 0 },
  {
    appid: 1145360,
    name: stabilityChecks
      ? 'Hades — длинное тестовое название для проверки читаемости карточки на маленьком экране'
      : 'Hades',
    genres: ['roguelike', 'action'],
    playtime: 40,
  },
].map((game) => ({
  ...game,
  cover_url: null,
  created_at: '2026-11-01T00:00:00Z',
  last_played_at: null,
  steam_imported: true,
}));

function session(steamId) {
  const now = Math.floor(Date.now() / 1000);
  const userId = '00000000-0000-4000-8000-000000000001';
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, iat: now, exp: now + 3600, role: 'authenticated' })}.synthetic`,
    refresh_token: 'synthetic-only',
    expires_at: now + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      app_metadata: { steam_id: steamId },
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-01T00:00:00Z',
    },
  };
}

const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let target = resolve(dist, `.${pathname}`);
    if (target !== dist && !target.startsWith(dist + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(target)).isFile()) target = resolve(dist, 'index.html');
    } catch {
      target = resolve(dist, 'index.html');
    }
    response.writeHead(200, {
      'content-type': types[extname(target)] || 'application/octet-stream',
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
let browser;
let browserVersion;

async function runCase(theme, width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  let apiOffline = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== apiOrigin || apiOffline) return route.abort();
    if (purchaseChecks && url.pathname.endsWith('/steam-catalog')) return fulfillCatalog(route);
    const body = url.pathname.endsWith('/steam-library')
      ? { games: rows }
      : url.pathname.endsWith('/rawg-enrich')
        ? { games: [], remaining: 0 }
        : url.pathname.startsWith('/rest/')
          ? []
          : {};
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await context.addInitScript((value) => localStorage.setItem('quaeso:theme', value), theme);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const tab = (name) => page.getByRole('tab', { name, exact: true });
  const radio = (name) => page.getByRole('radio', { name, exact: true });
  const screenshot = (name) =>
    page.screenshot({ path: resolve(artifacts, `${theme}-${width}-${name}.png`) });
  try {
    await page.goto(origin);
    await button('Попробовать без входа').click();
    await checkSessionTimeAndSearch(page);
    await button('Подобрать примерную игру').click();
    await button('Выбираю эту примерную игру').click();
    await page.getByText(/Примерный выбор принят только в демо/).waitFor();
    assert.equal(
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) =>
          /acceptedChoice|backlog|recommendationHistory/.test(key),
        ),
      ),
      false,
    );
    await screenshot('demo');
    await page.reload();
    await button('Подобрать примерную игру').waitFor();
    assert.equal(await page.getByText(/Примерный выбор принят только в демо/).count(), 0);
    await button('Вернуться ко входу в Steam').click();
    await button('Попробовать без входа').waitFor();
    const emailProfile = session(undefined);
    emailProfile.user.email = 'player@example.test';
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: authKey,
      value: emailProfile,
    });
    await page.goto(origin + '/demo?favorites=true');
    await tab('Избранное у друзей').click();
    await page.getByText('Избранное других игроков пока недоступно.').waitFor();
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: authKey,
      value: session(account),
    });
    await page.goto(origin);
    await button('Подобрать игру  →').waitFor({ state: 'visible' });
    await button('Открыть меню').click();
    await button('Избранное').click();
    await page.waitForURL('**/favorites');
    await tab('Избранное у друзей').click();
    await page.getByText('Избранное других игроков пока недоступно.').waitFor();
    assert.equal(await button('MintKnight').count(), 0);
    await button('К карточкам игр').click();
    await button('Понравилась игра').click();
    await button('Избранное (1)').waitFor();
    await button('Открыть меню').click();
    await button('Избранное').click();
    await page.waitForURL('**/favorites');
    await page.getByRole('button', { name: /^Подробнее о / }).click();
    await page.getByText(/в вашей библиотеке Quaeso/i).waitFor();
    await page.getByRole('button', { name: /^Удалить / }).click();
    await page.getByText('Пока ничего не добавлено.').waitFor();
    await page.goto(origin + '/demo?favorites=true');
    await tab('Избранное у друзей').click();
    await page.getByText('Избранное других игроков пока недоступно.').waitFor();
    await button('К карточкам игр').click();
    await button('Понравилась игра').waitFor();
    await page.goto(origin);
    await button('Подобрать игру  →').waitFor();
    if (purchaseChecks) {
      await checkPurchasePicks(page);
      assert.deepEqual(errors, []);
      await screenshot('purchase-picks');
      results.push({ theme, width, status: 'pass', checks: ['purchase-picks'] });
      return;
    }
    await radio('Продолжить').click();
    await tab('Библиотека').click();
    await page.getByRole('textbox', { name: 'Поиск по названию игры' }).fill('Portal');
    await tab('Настройки').click();
    await screenshot('settings');
    await tab('Библиотека').click();
    assert.equal(
      await page.getByRole('textbox', { name: 'Поиск по названию игры' }).inputValue(),
      'Portal',
    );
    await tab('Подбор').click();
    assert.equal(await radio('Продолжить').getAttribute('aria-checked'), 'true');
    await radio('Новое').click();
    await screenshot('picker');
    const action = await button('Подобрать игру  →').boundingBox();
    assert.ok(
      action && action.y >= 0 && action.y + action.height <= 844,
      'Main action outside viewport',
    );
    await button('Подобрать игру  →').click();
    if (installationChecks) {
      const mark = page.getByRole('checkbox', {
        name: 'Установлено на моём игровом компьютере',
        exact: true,
      });
      await mark.click();
      await page.waitForFunction(
        (key) => JSON.parse(localStorage.getItem(key) || '[]').includes(620),
        `playnow:installedGames:v1:${account}`,
      );
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), choiceKey), null);
      await page.goto(origin);
      const filter = page.getByRole('checkbox', {
        name: 'Только отмеченные установленными',
        exact: true,
      });
      await filter.click();
      await page.reload();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Только отмеченные установленными"]')
            ?.getAttribute('aria-checked') === 'true',
      );
      await button('Подобрать игру  →').click();
      await page.reload();
      await page.getByText(/Вы вручную отметили игру установленной/).waitFor();
      await screenshot('installed-result');
    }
    await button('Выбираю эту игру').click();
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, choiceKey);
    const choice = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), choiceKey);
    assert.equal(choice.game.appid, 620);
    if (installationChecks) assert.equal(choice.installedOnly, true);
    await screenshot('result');
    if (refusalChecks) {
      const confirmedChoice = await page.evaluate((key) => localStorage.getItem(key), choiceKey);
      await button('Начать новый круг').click();
      await button('Указать причину (необязательно)').click();
      await page.getByRole('radio', { name: 'Не установлена', exact: true }).click();
      await page.waitForFunction(
        (key) =>
          JSON.parse(localStorage.getItem(key) || '[]').some(
            (entry) => entry.game.appid === 620 && entry.refusal?.reason === 'not_installed',
          ),
        `playnow:recommendationHistory:v1:${account}`,
      );
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), choiceKey),
        confirmedChoice,
      );
      await screenshot('optional-refusal');
    }
    const savedChoice = await page.evaluate((key) => localStorage.getItem(key), choiceKey);
    await page.goto(origin);
    await page.getByText('Последний принятый выбор', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).game.appid, choiceKey),
      620,
    );
    apiOffline = true;
    await page.reload();
    await page.getByText('Последний принятый выбор', { exact: true }).waitFor();
    await page.getByText('Portal 2', { exact: true }).waitFor();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), choiceKey), savedChoice);
    await page.getByText('Последний принятый выбор', { exact: true }).scrollIntoViewIfNeeded();
    await screenshot('accepted-choice-after-reload');
    await tab('Библиотека').click();
    await page.getByRole('button', { name: /Portal 2/ }).waitFor();
    await screenshot('cached-library');
    apiOffline = false;
    if (historyChecks) {
      await page.goto(origin);
      await button('История рекомендаций').click();
      await page.getByRole('heading', { name: 'Portal 2', exact: true }).first().waitFor();
      await page.reload();
      await button('Открыть рекомендацию Portal 2').first().click();
      const previous = await page.evaluate((key) => localStorage.getItem(key), choiceKey);
      const historyKey = `playnow:recommendationHistory:v1:${account}`;
      let beforeBrowsing = await page.evaluate((key) => localStorage.getItem(key), historyKey);
      if (refusalChecks) await page.getByText(/Последняя причина отказа: Не установлена/).waitFor();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), choiceKey), previous);
      await button('Выбираю эту игру из истории').click();
      await page.waitForFunction(({ key, previous }) => localStorage.getItem(key) !== previous, {
        key: choiceKey,
        previous,
      });
      const acceptedFromHistory = await page.evaluate(
        (key) => localStorage.getItem(key),
        choiceKey,
      );
      assert.equal(JSON.parse(acceptedFromHistory).game.appid, 620);
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), historyKey),
        beforeBrowsing,
      );
      await screenshot('history');
      if (refusalChecks) {
        await button('Удалить причину отказа').click();
        await page.waitForFunction(
          (key) => JSON.parse(localStorage.getItem(key) || '[]').every((entry) => !entry.refusal),
          historyKey,
        );
        beforeBrowsing = await page.evaluate((key) => localStorage.getItem(key), historyKey);
      }
      page.once('dialog', (dialog) => dialog.dismiss());
      await button('Очистить историю рекомендаций').click();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), historyKey),
        beforeBrowsing,
      );
      page.once('dialog', (dialog) => dialog.accept());
      await button('Очистить историю рекомендаций').click();
      await page.getByText(/История пока пуста/).waitFor();
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), choiceKey),
        acceptedFromHistory,
      );
    }
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: authKey,
      value: session('76561197960287931'),
    });
    await page.goto(origin);
    await button('Подобрать игру  →').waitFor();
    assert.equal(await page.getByText('Последний принятый выбор', { exact: true }).count(), 0);
    if (historyChecks) {
      await button('История рекомендаций').click();
      await page.getByText(/История пока пуста/).waitFor();
      assert.equal(await page.getByText('Portal 2', { exact: true }).count(), 0);
    }
    if (installationChecks) {
      await button('К подбору').click();
      const filter = page.getByRole('checkbox', {
        name: 'Только отмеченные установленными',
        exact: true,
      });
      assert.equal(await filter.getAttribute('aria-checked'), 'false');
      await filter.click();
      await button('Подобрать игру  →').click();
      await page.getByText(/Среди отмеченных установленными нет игр/).waitFor();
      await screenshot('unmarked-account-empty');
      assert.equal(
        await page.evaluate(() =>
          Object.entries(localStorage).some(
            ([key, value]) =>
              key.endsWith(':76561197960287931') &&
              key.includes('installedGames') &&
              value.includes('620'),
          ),
        ),
        false,
      );
    }
    if (stabilityChecks) {
      await page.setViewportSize({ width: 844, height: 390 });
      await button('К подбору').click();
      const landscapeCTA = page
        .getByTestId('screen-content-scroll')
        .getByRole('button', { name: 'Подобрать игру  →', exact: true });
      await landscapeCTA.waitFor();
      await landscapeCTA.scrollIntoViewIfNeeded();
      const landscapeAction = await landscapeCTA.boundingBox();
      assert.ok(
        landscapeAction &&
          landscapeAction.y >= 0 &&
          landscapeAction.y + landscapeAction.height <= 390,
        'Landscape action cannot be reached by scrolling',
      );
      await screenshot('landscape-action');
      await tab('Библиотека').click();
      await page.setViewportSize({ width: 320, height: 568 });
      const longTitle = rows[1].name;
      await page.getByRole('button', { name: new RegExp(longTitle) }).scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        for (const element of document.querySelectorAll('div[dir="auto"]')) {
          const style = getComputedStyle(element);
          element.style.fontSize = `${parseFloat(style.fontSize) * 1.6}px`;
          if (style.lineHeight !== 'normal')
            element.style.lineHeight = `${parseFloat(style.lineHeight) * 1.6}px`;
        }
      });
      const card = page.getByRole('button', { name: new RegExp(longTitle) });
      await card.scrollIntoViewIfNeeded();
      const cardBounds = await card.boundingBox();
      const nameBounds = await page.getByText(longTitle, { exact: true }).boundingBox();
      assert.ok(
        cardBounds &&
          nameBounds &&
          nameBounds.y + nameBounds.height <= cardBounds.y + cardBounds.height,
        'Large text clipped by library card',
      );
      await screenshot('large-text-library');
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    results.push({
      theme,
      width,
      status: 'pass',
      checks: [
        'guest-demo-isolation',
        'demo-reload-return-to-login',
        'tab-state',
        'accepted-choice-reload',
        'cached-library-with-api-unavailable',
        'account-choice-isolation',
        'main-action',
        'no-page-errors',
        ...(installationChecks
          ? [
              'manual-installation-mark',
              'installed-filter-reload',
              'installed-result-url-reload',
              'installed-choice-snapshot',
              'installed-account-isolation',
            ]
          : []),
        ...(refusalChecks
          ? [
              'optional-refusal-after-next',
              'refusal-preserves-choice',
              'refusal-reload-and-removal',
            ]
          : []),
        ...(stabilityChecks ? ['landscape-action-scroll', 'narrow-library-large-text'] : []),
        ...(historyChecks
          ? [
              'history-reload',
              'history-explicit-acceptance',
              'history-browsing-no-write',
              'history-clear-preserves-choice',
              'history-account-isolation',
            ]
          : []),
      ],
    });
  } catch (error) {
    await screenshot('failure');
    results.push({ theme, width, status: 'fail', error: error.message });
    throw error;
  } finally {
    await context.close();
  }
}

try {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
  );
  browserVersion = browser.version();
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 390]) await runCase(theme, width);
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  await writeFile(
    resolve(artifacts, 'summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        evidence: 'synthetic-browser-smoke-only',
        browserVersion,
        bundles,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
process.stdout.write(
  `${purchaseChecks ? 'Purchase picks' : 'Stage ' + (installationChecks ? 11 : refusalChecks ? 10 : stabilityChecks ? 9 : historyChecks ? 8 : 7)} synthetic web smoke: ${results.length}/4 cases passed. Artifacts: ${artifacts}\n`,
);
