# PlayNow

Мобильное приложение, которое подбирает игру из вашего Steam-бэклога под контекст: сколько есть времени и какое настроение.

> Полная инструкция появится на этапе 14. Ниже то, что уже работает.

## Быстрый старт

```bash
npm install
npx expo start
```

`.env` для запуска **не обязателен**. Публичная конфигурация проекта Supabase уже лежит в `app.json` → `extra`:

- `extra.supabaseUrl` — URL проекта Supabase;
- `extra.supabaseAnonKey` — publishable/anon key (публичный по своей природе: доступ к данным ограничивает RLS);
- `extra.privacyPolicyUrl` — ссылка на политику конфиденциальности для экрана настроек.

`app.config.ts` только прокидывает эти значения в итоговый `extra`, поэтому приложение стартует «из коробки», без локального env-файла.

`.env` нужен, только если вы подключаете приложение к **другому** проекту Supabase:

```bash
cp .env.example .env   # и заполните значения
```

Переменные окружения и куда каждая попадает:

- `SUPABASE_URL` — URL проекта Supabase. Переопределяет `extra.supabaseUrl` и попадает в клиентский бандл.
- `SUPABASE_ANON_KEY` — anon/publishable key. Переопределяет `extra.supabaseAnonKey` и попадает в клиентский бандл.
- `STEAM_API_KEY`, `RAWG_API_KEY` — **серверные** секреты. В приложение и в `extra` не попадают: они живут только в секретах Edge Functions (`npx supabase secrets set …`, см. [docs/SETUP_KEYS.md](docs/SETUP_KEYS.md)).
- `service_role` / secret key Supabase не кладите ни в `.env`, ни в приложение: он обходит RLS и даёт полный доступ к базе.

## Проверки

```bash
npm run validate    # typecheck + eslint + prettier --check
```

- `npx expo config --type public` печатает итоговый конфиг. В `extra` должны быть только `supabaseUrl`, `supabaseAnonKey` и `privacyPolicyUrl`; ключей `STEAM_API_KEY`/`RAWG_API_KEY` там быть не должно.
- `npx expo export --platform web` проверяет, что приложение собирается без устройства. Каталог `dist/` в `.gitignore`.

Файлы репозитория хранятся в LF: так задано в `.gitattributes` (`* text=auto eol=lf`, CRLF оставлен только для `*.bat`, `*.cmd`, `*.ps1`) и в Prettier (`endOfLine: "lf"`). На Windows не включайте `core.autocrlf=true` и не коммитьте CRLF — расхождение поймает `npm run format:check` (входит в `npm run validate`).

## Скрипты

| Команда                           | Что делает                         |
| --------------------------------- | ---------------------------------- |
| `npm start`                       | dev-сервер Expo                    |
| `npm run typecheck`               | проверка типов (TypeScript strict) |
| `npm run lint` / `lint:fix`       | ESLint (+ Prettier как правило)    |
| `npm run format` / `format:check` | Prettier                           |
| `npm run validate`                | typecheck + lint + format:check    |

## Структура

```
src/
  features/      auth, backlog, picker, settings (экраны, компоненты, хуки, сервисы, типы)
  shared/        components, hooks, services, utils, types, constants, config
  navigation/    навигаторы React Navigation
supabase/        миграции и Edge Functions (прокси к Steam/RAWG)
tests/           unit (Jest) и e2e (Detox)
```

Импорты из `src` пишутся через алиас `@/`, например `import { colors } from '@/shared/constants'`.
