# Supabase

## Схема

| Таблица         | Назначение                                          | Доступ клиента (RLS)                      |
| --------------- | --------------------------------------------------- | ----------------------------------------- |
| `users`         | профиль: `id` = `auth.users.id`, `steam_id`         | только чтение своей строки                |
| `games`         | бэклог пользователя, уникален по `(user_id, appid)` | CRUD своих строк, `user_id` менять нельзя |
| `play_sessions` | история запусков игр                                | CRUD своих строк, только на свои игры     |

`users` создаёт и обновляет только Edge Function под `service_role` после проверки входа через Steam (этап 4).
Иначе клиент мог бы подставить чужой `steam_id` и получить чужую библиотеку.

## Применить миграции к проекту

```bash
npx supabase login
npx supabase link --project-ref <ref из URL проекта>
npx supabase db push
```

## Проверить RLS

Против локального Supabase (`npx supabase start`, нужен Docker):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

Скрипт работает в транзакции с откатом. Любая проваленная проверка останавливает его с `FAIL: ...`.

## Типы для клиента

`src/shared/types/database.ts` пока описан вручную. После `link` можно генерировать:

```bash
npx supabase gen types typescript --linked > src/shared/types/database.ts
```
