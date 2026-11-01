# PlayNow

Мобильное приложение, которое подбирает игру из вашего Steam-бэклога под контекст: сколько есть времени и какое настроение.

> Полная инструкция появится на этапе 14. Ниже то, что уже работает.

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполните значения
npx expo start
```

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
