# Edge Functions

Три функции Supabase, которые проксируют Steam и RAWG и держат их ключи на сервере:
`steam-auth` (вход через Steam OpenID), `steam-library` (импорт библиотеки) и
`rawg-enrich` (жанры и обложки). Общий код — в `_shared/`.

Каталог исключён из корневого `tsconfig.json` и `eslint.config.js`: это код Deno, а не
React Native, поэтому у него отдельная проверка.

## Проверка типов и тестов

Одна команда из корня репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-functions.ps1
```

Скрипт:

- берёт portable Deno из `.tools\deno\deno.exe` и кэш кладёт в `.tools\deno-cache`
  (оба каталога в `.gitignore`), поэтому установка в систему и права администратора не нужны;
- запускает `deno check` для трёх точек входа и `deno test` для файлов `*.test.ts`;
- печатает итог и возвращает `0`, если всё прошло, и `1` при ошибке.

Если Deno ещё не скачан, скрипт подскажет ссылку на архив. Первый запуск требует сети:
Deno скачивает зависимости в кэш.

То же самое вручную:

```powershell
$env:DENO_DIR = "$PWD\.tools\deno-cache"
.\.tools\deno\deno.exe check supabase/functions/steam-auth/index.ts `
  supabase/functions/steam-library/index.ts `
  supabase/functions/rawg-enrich/index.ts
.\.tools\deno\deno.exe test --allow-net --allow-env --allow-read supabase/functions/
```

`DENO_DIR` указывает на каталог внутри workspace, чтобы проверки были воспроизводимы и не
писали в `%LOCALAPPDATA%`.

Тесты лежат рядом с функциями (`openid.test.ts`, `steam.test.ts`, `enrich.test.ts`,
`rawg.test.ts`, `steamCover.test.ts`). Сеть им не нужна: HTTP-вызовы подменяются заглушками,
поэтому `--allow-net` нужен только на случай, если проверка захочет обновить зависимости.

## Запуск и деплой

Функции запускаются на Deno в Supabase, локальный `deno run` им не нужен. Секреты
(`STEAM_API_KEY`, `RAWG_API_KEY`, `SUPABASE_*`) задаются через `npx supabase secrets set`,
подробности — в [docs/SETUP_KEYS.md](../../docs/SETUP_KEYS.md) и
[docs/STEAM_AUTH.md](../../docs/STEAM_AUTH.md).
