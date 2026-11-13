import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { Buffer } from 'node:buffer';

// Two isolated browser contexts, synthetic API only. Never sends traffic to live Supabase.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dist = resolve(process.argv[2] || '.tools/stage12-export');
const artifacts = resolve('.tools/stage12-qa');
await mkdir(artifacts, { recursive: true });
const config = JSON.parse(await readFile('app.json', 'utf8'));
const api = new URL(config.expo.extra.supabaseUrl).origin;
const account = '76561197960287930';
const authKey = `sb-${new URL(api).hostname.split('.')[0]}-auth-token`;
const choiceKey = `playnow:acceptedChoice:v1:${account}`;
const blacklistKey = `playnow:blacklist:v1:${account}`;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const uid = '00000000-0000-4000-8000-000000000001';
const now = Math.floor(Date.now() / 1000);
const session = {
  access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, role: 'authenticated', iat: now, exp: now + 3600 })}.synthetic`,
  refresh_token: 'synthetic-only',
  expires_in: 3600,
  expires_at: now + 3600,
  token_type: 'bearer',
  user: {
    id: uid,
    app_metadata: { steam_id: account },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
};
const choice = (appid) => ({
  game: { appid, name: appid === 620 ? 'Portal 2' : 'Hades' },
  contextId: 'action',
  mode: 'new',
  genreFilter: 'any',
  acceptedAt: new Date().toISOString(),
});
const server = createServer(async (request, response) => {
  try {
    let target = resolve(
      dist,
      `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`,
    );
    if (target !== dist && !target.startsWith(dist + sep)) return response.writeHead(403).end();
    try {
      if (!(await stat(target)).isFile()) target = resolve(dist, 'index.html');
    } catch {
      target = resolve(dist, 'index.html');
    }
    response.writeHead(200, {
      'content-type':
        {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
        }[extname(target)] || 'application/octet-stream',
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {},
  );
  for (const theme of ['dark', 'light'])
    for (const width of [320, 390]) {
      let cloud = { revision: 0, snapshot: { choice: null, postponed: {} }, mutationId: null };
      const errors = [];
      const contexts = [];
      const open = async (initial) => {
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          reducedMotion: 'reduce',
        });
        contexts.push(context);
        let offline = false;
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await context.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin === origin) return route.continue();
          if (url.origin !== api || offline) return route.abort();
          let body = [];
          if (url.pathname.endsWith('/picker_sync_state'))
            body = cloud.revision
              ? {
                  revision: cloud.revision,
                  snapshot: cloud.snapshot,
                  mutation_id: cloud.mutationId,
                }
              : null;
          else if (url.pathname.endsWith('/rpc/write_picker_sync')) {
            const args = route.request().postDataJSON();
            const applied =
              args.expected_revision === cloud.revision || args.operation_id === cloud.mutationId;
            if (applied && args.operation_id !== cloud.mutationId)
              cloud = {
                revision: cloud.revision + 1,
                snapshot: args.new_snapshot,
                mutationId: args.operation_id,
              };
            body = { ...cloud, applied };
          } else if (url.pathname.endsWith('/steam-library'))
            body = {
              games: [620, 570].map((id) => ({
                appid: id,
                name: id === 620 ? 'Portal 2' : 'Hades',
                genres: ['action'],
                playtime: 0,
                last_played_at: null,
                steam_imported: true,
                cover_url: null,
                created_at: '2026-11-01T00:00:00Z',
              })),
            };
          else if (url.pathname.endsWith('/rawg-enrich')) body = { games: [], remaining: 0 };
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        });
        await page.goto(origin);
        await page.evaluate(
          ({ authKey, session, theme, choiceKey, blacklistKey, initial }) => {
            localStorage.setItem(authKey, JSON.stringify(session));
            localStorage.setItem('quaeso:theme', theme);
            if (initial) {
              localStorage.setItem(choiceKey, JSON.stringify(initial.choice));
              localStorage.setItem(blacklistKey, JSON.stringify(initial.postponed));
            }
          },
          { authKey, session, theme, choiceKey, blacklistKey, initial },
        );
        await page.reload();
        const button = (name) => page.getByRole('button', { name, exact: true });
        const settings = async () => page.getByRole('tab', { name: /Настройки$/ }).click();
        await settings();
        return {
          page,
          button,
          settings,
          offline: (value) => {
            offline = value;
          },
        };
      };
      try {
        const left = await open({ choice: choice(620), postponed: { 570: Date.now() + 86400000 } });
        const right = await open(null);
        assert.equal(cloud.revision, 0, 'no sync before opt-in');
        for (const d of [left, right]) {
          await d.button('Включить синхронизацию выбора и отложенных игр').click();
          await d.page.getByText(/^Синхронизировано/).waitFor();
        }
        await right.page.waitForFunction(
          (key) => JSON.parse(localStorage.getItem(key) || 'null')?.game.appid === 620,
          choiceKey,
        );
        assert.equal(
          await right.page.evaluate(
            (key) => Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length,
            blacklistKey,
          ),
          1,
        );
        await right.page.getByRole('tab', { name: 'Подбор', exact: true }).click();
        await right.page.getByRole('button', { name: /^Отложенные игры ·/ }).click();
        await right.button('Вернуть «Hades» в подбор').click();
        await right.page.getByText('Отложенных игр нет', { exact: true }).waitFor();
        await right.page.goto(origin);
        await right.settings();
        await right.button('Синхронизировать сейчас').click();
        await right.page.getByText(/^Синхронизировано/).waitFor();
        await left.button('Синхронизировать сейчас').click();
        await left.page.getByText(/^Синхронизировано/).waitFor();
        assert.deepEqual(
          await left.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), blacklistKey),
          {},
        );
        right.offline(true);
        await right.page.evaluate(
          ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
          { key: choiceKey, value: choice(570) },
        );
        await right.page.reload();
        await right.settings();
        await right.page.getByText(/Не удалось синхронизировать/).waitFor();
        assert.equal(
          await right.page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)).game.appid,
            choiceKey,
          ),
          570,
        );
        await left.page.evaluate(
          ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
          { key: choiceKey, value: { ...choice(620), mode: 'continue' } },
        );
        await left.page.reload();
        await left.settings();
        await left.page.getByText(/^Синхронизировано/).waitFor();
        right.offline(false);
        await right.button('Синхронизировать сейчас').click();
        await right.page
          .getByText('Изменения расходятся. Выберите версию.', { exact: true })
          .waitFor();
        await right.page.screenshot({ path: resolve(artifacts, `${theme}-${width}-conflict.png`) });
        await right.button('Использовать версию из аккаунта').click();
        await right.page.getByText(/^Синхронизировано/).waitFor();
        assert.equal(
          await right.page.evaluate((key) => JSON.parse(localStorage.getItem(key)).mode, choiceKey),
          'continue',
        );
        await right.button('Выключить синхронизацию на этом устройстве').click();
        await right.page.reload();
        await right.settings();
        await right.button('Включить синхронизацию выбора и отложенных игр').waitFor();
        assert.deepEqual(errors, []);
        results.push({
          theme,
          width,
          status: 'pass',
          checks: [
            'opt-in',
            'two-context-pull',
            'postponement-removal',
            'offline-restart',
            'explicit-conflict',
            'disable-restart',
          ],
        });
      } catch (error) {
        for (const [index, context] of contexts.entries()) {
          const page = context.pages()[0];
          if (page) {
            await page.screenshot({
              path: resolve(artifacts, `${theme}-${width}-${index}-failure.png`),
            });
            await writeFile(
              resolve(artifacts, `${theme}-${width}-${index}-failure.txt`),
              await page.locator('body').innerText(),
            );
          }
        }
        throw error;
      } finally {
        for (const context of contexts) await context.close();
      }
    }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  await writeFile(
    resolve(artifacts, 'summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        evidence: 'synthetic-two-browser-contexts-only',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(`Stage 12 sync web smoke: ${results.length}/4 cases passed`);
