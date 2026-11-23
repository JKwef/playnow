# App access: инструкция для ревьюера Google Play

Play Console → **App content → App access**. Приложение требует входа через Steam,
поэтому в поле нужно выбрать вариант **«All or some functionality is restricted»**
и приложить инструкцию ниже. Без неё ревьюер упрётся в экран входа и отклонит релиз.

## Что заполнить в Play Console

- **All or some functionality is restricted** → Add instructions.
- В инструкции указать тестовые данные и шаги (готовый текст ниже).
- Email поддержки — тот же, что в листинге (`support@playnow.app`, placeholder).
- Если появится отдельное поле для URL удаления аккаунта — указать
  `https://github.com/JKwef/playnow/blob/main/docs/account-deletion.md`.

## Готовый текст для поля инструкций

> Quaeso requires a Steam account to import the game library.
>
> 1. Launch the app. On the login screen tap **«Войти через Steam»** (Sign in with Steam).
> 2. A browser opens on steamcommunity.com. Sign in with the test account below and
>    approve the access request. The app reopens automatically via the `playnow://` link.
> 3. Wait for the library to load (up to 1–2 minutes for large libraries; a few seconds
>    for the test account).
> 4. Main flow: choose one of four context cards on the Picker screen → the Result screen
>    shows one recommended game. Tabs: «Игры» (backlog list), ⚙ (settings).
> 5. Account deletion: Settings → «Удалить аккаунт». Please do **not** delete the test
>    account — or tell us in the review notes if you need a fresh one; we recreate it for
>    each release.
>
> Test Steam account:
>
> - Steam login: `REPLACE_WITH_TEST_STEAM_LOGIN`
> - Steam password: `REPLACE_WITH_TEST_STEAM_PASSWORD`
> - Steam ID: `REPLACE_WITH_TEST_STEAM_ID`
>
> Notes:
>
> - Steam may ask for a Steam Guard code. The test account uses email-based Steam Guard;
>   the code is available at `REPLACE_WITH_REVIEW_EMAIL` if requested. Please contact us
>   if a code is needed — we can disable the check for the review period.
> - The core flow (login, library import, picking, filters, deletion) does not require the
>   Steam mobile app. The «Открыть в Steam» button opens the installed Steam app; if Steam
>   is not installed on the test device, the app shows a clear message and this is expected.
> - The app is in Russian only (ru-RU listing); UI labels above are given in both languages.

## Данные тестового аккаунта Steam

Нужен отдельный **не основной** Steam-аккаунт:

1. Зарегистрируйте аккаунт вида `playnow.review.<год>` (потребуется e-mail, который
   принадлежит вам; Steam может ограничить новый аккаунт — «limited account»).
2. Сделайте профиль открытым: Steam → «Редактировать профиль» → «Настройки приватности» →
   «Мой профиль» и «Игровая информация» → «Открытый». Иначе Quaeso покажет инструкцию
   для приватного профиля — тоже рабочий сценарий, но он не демонстрирует основной путь.
3. Добавьте 3–5 бесплатных игр в библиотеку (например, бесплатные игры Steam), пару из них
   запустите, чтобы появились даты последнего запуска.
4. Запишите логин, пароль и Steam ID. Пароль и почту храните в менеджере паролей; не
   коммитьте их в репозиторий.
5. Проверьте вход в Quaeso именно с этого аккаунта на чистом устройстве/эмуляторе.

## Если тестовый Steam-аккаунт недоступен

Steam Guard и ограничения новых аккаунтов могут помешать ревьюеру. Рекомендуемый запасной
вариант — **демо-режим внутри приложения** (сейчас не реализован; нужен отдельной задачей):

- на экране входа добавить пункт «Посмотреть демо»;
- демо не требует сети и Steam: показывает заранее заготовленный список из 10–15 игр
  и все экраны (подбор, результат, бэклог, настройки);
- выход из демо — без удаления реальных данных.

Пока демо-режима нет, закладывайте время на переписку с ревьюерами через Play Console:
если они не смогут войти, попросите их написать на support@playnow.app, и мы оперативно
создадим/обновим тестовый аккаунт.

## Подсказки ревьюеру по экранам

| Экран    | Что проверить                                                               |
| -------- | --------------------------------------------------------------------------- |
| Вход     | Кнопка «Войти через Steam», ссылка на политику конфиденциальности           |
| Picker   | Четыре карточки контекста, счётчики подходящих игр, кнопки «Игры» и ⚙       |
| Result   | Подобранная игра, «Открыть в Steam», «Другой вариант», «Отложить»           |
| Backlog  | Поиск, фильтры по жанрам, сортировка, ручное добавление игры (＋)           |
| Settings | «Обновить бэклог», «Выйти из аккаунта», «Удалить аккаунт», версия, политика |

## Удаление аккаунта

Проверьте, что путь «Настройки → Удалить аккаунт» открывает диалог подтверждения с
предупреждением о необратимости. Для проверки используйте отдельный аккаунт: удаление
нельзя отменить.
