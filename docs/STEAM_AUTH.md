# Вход через Steam

Steam поддерживает только **OpenID 2.0**, не OAuth 2.0, а у Supabase Auth нет провайдера Steam.
Поэтому мост между ними сделан в Edge Function `supabase/functions/steam-auth`.

## Как это работает

```
Приложение                        Edge Function steam-auth                 Steam
    │ 1. verifier (случайный), challenge = SHA256(verifier)
    │──GET /start?challenge&redirect──▶│
    │                                   │──302──▶ страница входа steamcommunity.com
    │                                   │◀─GET /callback?openid.*── (пользователь вошёл)
    │                                   │ 2. POST check_authentication ──▶ Steam: «подпись верна?»
    │◀──302 playnow://auth?code=…───────│ 3. code = подписанный {steamId, challenge, exp 2 мин}
    │──POST /exchange {code, verifier}─▶│ 4. SHA256(verifier) == challenge?
    │                                   │    создаёт/находит пользователя, upsert public.users
    │◀──{access_token, refresh_token}───│
    │ 5. supabase.auth.setSession() → сессия в SecureStore
```

Почему так:

- **Системный браузер, а не WebView.** Приложение не видит пароль Steam, пользователь видит настоящий адрес,
  работают сохранённый вход и Steam Guard. Используется `expo-web-browser` (ASWebAuthenticationSession / Chrome Custom Tabs).
- **Подпись Steam проверяет сервер.** Параметры приходят через браузер, и подделать `claimed_id` может кто угодно.
  Достоверность подтверждает только запрос `check_authentication` к самому Steam.
- **PKCE.** Код в редиректе можно перехватить: на Android схему `playnow://` может зарегистрировать чужое приложение.
  Но без `verifier`, который не покидает приложение, обменять код на сессию нельзя.
- **`steam_id` в `app_metadata`.** Её может писать только service role, пользователь подменить её не может.

## Деплой функции

Вариант А, через CLI (из корня репозитория):

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase functions deploy steam-auth --no-verify-jwt
```

`--no-verify-jwt` обязателен: функцию вызывают браузер и редирект из Steam, у которых нет JWT.
В `supabase/config.toml` это тоже указано.

Вариант Б, в дашборде: **Edge Functions → Deploy a new function → Via Editor**. Назовите функцию `steam-auth`,
создайте два файла `index.ts` и `openid.ts` с содержимым из репозитория, затем в настройках функции
выключите **Enforce JWT verification**.

Новых секретов не нужно: `SUPABASE_URL`, `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` Supabase передаёт сам.
Необязательные секреты:

- `ALLOWED_REDIRECT_PREFIXES`: куда разрешён возврат, по умолчанию `playnow://,exp://`;
- `STEAM_AUTH_CODE_SECRET`: отдельный ключ подписи кодов, по умолчанию выводится из service role.

## Проверка

```bash
# Должен вернуть 302 на steamcommunity.com
curl -i "https://<ref>.supabase.co/functions/v1/steam-auth/start?challenge=$(printf 'a%.0s' {1..43})&redirect=playnow://auth"
```

## Тесты

```bash
deno test supabase/functions/steam-auth/
```

## Импорт библиотеки (steam-library)

`POST /functions/v1/steam-library` с `Authorization: Bearer <access_token>`.
Функция сама проверяет токен через `auth.getUser`, берёт SteamID из `app_metadata`
(не из запроса) и вызывает `GetOwnedGames` с `STEAM_API_KEY` из секретов.
Результат сохраняется в `games` (upsert по `user_id, appid`, жанры не затираются) и возвращается клиенту.
Приватный профиль → `403 {"error":"private_profile"}`.

```bash
npx supabase functions deploy steam-library --no-verify-jwt
```

## Жанры из RAWG (этап 6, функция `rawg-enrich`)

Steam не отдаёт жанры, поэтому после каждого импорта приложение догружает их из RAWG (FR2.3):

1. Клиент вызывает `POST /functions/v1/rawg-enrich` с JWT пользователя, пока `remaining` не станет 0.
2. Функция берёт до 80 игр пользователя, которые ещё не искали в RAWG (`games.rawg_checked_at is null`),
   сначала непройденные, и ищет каждую по названию (`/api/games?search=…&page_size=5`, 5 запросов параллельно).
3. Из результатов выбирается игра с тем же названием (без ™/®, регистра и пунктуации); если похожей нет,
   жанры не берутся, чтобы не приписать игре чужие.
4. Жанры RAWG приводятся к нашим ключам (`role-playing-games-rpg` → `rpg`), а теги `roguelike`/`roguelite`
   и `story-rich` превращаются в жанры `roguelike` и `narrative`, которые нужны контекстам Solo Mode.
5. Игра помечается `rawg_checked_at`, поэтому повторные импорты не тратят квоту RAWG. Обложка Steam
   сохраняется, из RAWG берётся только недостающая. Жанры, заданные вручную, не перезаписываются.

Сбой RAWG по отдельной игре оставляет её непроверенной до следующего импорта. Неверный ключ или лимит
запросов останавливают партию (`503 rawg_unavailable`), а список игр при этом продолжает работать.

Деплой: `npx supabase functions deploy rawg-enrich --no-verify-jwt`, секрет `RAWG_API_KEY`.
