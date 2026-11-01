# Ключи и аккаунты для PlayNow

Нужно три вещи: проект Supabase, ключ Steam Web API, ключ RAWG.
**Никогда не присылайте ключи в чат и не коммитьте их.** `.env` уже в `.gitignore`.

## 1. Supabase (≈5 минут)

1. Зарегистрируйтесь на <https://supabase.com/dashboard> (можно через GitHub).
2. **New project**:
   - Name: `playnow`
   - Database password: сгенерируйте и сохраните в менеджер паролей (понадобится для `db push`)
   - Region: ближайший к пользователям, например `Central EU (Frankfurt)`
   - Тариф Free подходит для MVP
3. Дождитесь создания (1–2 минуты) и откройте **Project Settings → API Keys** (в старом интерфейсе **Settings → API**). Вам нужны:
   - **Project URL** вида `https://abcdefgh.supabase.co` → `SUPABASE_URL`
   - **anon / publishable key** (`eyJ...` или `sb_publishable_...`) → `SUPABASE_ANON_KEY`
   - **Project ref**: часть URL до `.supabase.co` (`abcdefgh`), нужен для `supabase link`

> ⚠️ Ключ `service_role` / `secret` в приложение и в `.env` **не кладите**. Он обходит RLS и даёт полный доступ к базе.
> Edge Functions получают его автоматически.

## 2. Steam Web API key (≈2 минуты)

1. Войдите в Steam и откройте <https://steamcommunity.com/dev/apikey>.
2. **Domain Name**: любой ваш домен или, например, `github.com/JKwef/playnow`. Это просто метка.
3. Примите условия и нажмите **Register**. Скопируйте ключ (32 символа) → `STEAM_API_KEY`.

Ограничения:

- Аккаунт должен быть не «limited»: на нём нужно потратить в Steam от $5. Иначе страница ключ не выдаст.
- Лимит 100 000 запросов в сутки, для MVP хватит с запасом.
- Если ключ утёк, на той же странице нажмите **Revoke** и создайте новый.

## 3. RAWG API key (≈2 минуты)

1. Зарегистрируйтесь на <https://rawg.io/apidocs> → **Get API Key**.
2. Заполните короткую форму о проекте (название PlayNow, описание в одну строку).
3. Скопируйте ключ из личного кабинета → `RAWG_API_KEY`.

Ограничения бесплатного тарифа: около 20 000 запросов в месяц.
RAWG требует указывать источник: ставить ссылку на rawg.io там, где показываются его данные. Это учтём на экранах.

## 4. Куда положить ключи

### Локально, в `.env`

```bash
cp .env.example .env
```

`SUPABASE_URL` и `SUPABASE_ANON_KEY` заполнять не обязательно: значения проекта уже лежат в `app.json` → `extra`.
источник для команды ниже. В приложение они не попадают (это обеспечивает `app.config.ts`).

### На сервере, в секретах Supabase Edge Functions

```bash
npx supabase login                       # откроет браузер
npx supabase link --project-ref <ref>    # введите пароль БД из шага 1
npx supabase secrets set STEAM_API_KEY=<ключ> RAWG_API_KEY=<ключ>
npx supabase secrets list                # проверить, что секреты на месте (значения скрыты)
```

То же можно сделать в дашборде: **Edge Functions → Secrets**.

### Применить схему базы

```bash
npx supabase db push
```

## 5. Проверка

```bash
npx expo start
```

Если приложение не стартует с ошибкой «Не заданы переменные окружения», проверьте `.env`.
После правки `.env` перезапустите `npx expo start` (с флагом `-c`, чтобы сбросить кэш).
