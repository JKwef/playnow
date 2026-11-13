# EAS: сборка и публикация Android-релиза PlayNow

Документ описывает путь от исходников до AAB в Google Play через Expo Build (EAS Build), EAS Submit
и Google Play. Часть шагов **невозможно автоматизировать без аккаунтов Expo и Google Play** — они
помечены как ручные.

- Пакет: `com.jkwef.playnow` (app.json → `android.package`).
- Проект нативный код не хранит: `android/` и `ios/` генерируются CNG-ом (`expo prebuild`).
- Конфигурация сборки: `eas.json` (уже в репозитории).

## 1. Что понадобится

| Что                                   | Кому нужно                  | Где взять                                                |
| ------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Аккаунт Expo (бесплатный или платный) | сборка/сабмит               | <https://expo.dev/signup>                                |
| EAS CLI ≥ 16                          | локально и в CI             | `npm i -g eas-cli`                                       |
| Google Play Developer аккаунт         | публикация                  | <https://play.google.com/apps/publish/signup/>           |
| Приложение в Play Console             | публикация                  | Play Console → **Create app**                            |
| Google service account key (JSON)     | `eas submit` через Play API | гайд: <https://expo.fyi/creating-google-service-account> |

## 2. Установка EAS CLI и вход

```sh
# глобально
npm install --global eas-cli

# или без глобальной установки
npx eas-cli@latest <команда>

eas --version   # должно быть >= 16.0.0 (eas.json → cli.version)
eas login       # интерактивно: e-mail/пароль или браузер
eas whoami      # проверка, под каким аккаунтом работаем
```

В CI вместо интерактивного логина используется токен:

```sh
export EXPO_TOKEN=<personal access token из настроек аккаунта Expo>
```

Ручной шаг: зарегистрировать аккаунт Expo и выполнить `eas login` — без этого `eas init`/`eas build`
не работают.

## 3. Инициализация проекта (`eas init`)

```sh
eas init
```

Что делает команда:

1. создаёт (или привязывает) проект на expo.dev;
2. записывает `extra.eas.projectId` в конфигурацию приложения.

Для этого проекта конфиг динамический (`app.config.ts` поверх `app.json`), поэтому `projectId`
попадёт в `app.json` → `expo.extra.eas.projectId` и сохранится после спреда `...config.extra`.
Проверить:

```sh
eas project:info
```

Ручной шаг: `eas init` требует аккаунт Expo и интерактивное подтверждение. Файл `app.config.ts` при
этом править не нужно.

## 4. Android credentials и upload keystore

```sh
eas credentials --platform android
```

Интерактивно выбрать профиль `production` и дальше:

- **Build credentials → Keystore**
  - `Generate new keystore` — EAS создаст keystore и будет хранить его на своих серверах (рекомендуемый
    вариант для нового проекта);
  - `Upload existing keystore` — если keystore уже есть (`*.jks` + alias + пароли).
- **Google Service Account → Set up a Google Service Account Key for Play Store Submissions** —
  загрузить JSON-ключ сервисного аккаунта для будущего `eas submit`.

EAS хранит keystore удалённо; локально ничего коммитить не нужно. В репозиторий **нельзя** добавлять
`*.jks`, `keystore`, `credentials.json`, пароли и JSON-ключи сервисного аккаунта (`.gitignore` уже
исключает `*.jks`, `*.p8`, `*.p12`, `*.key`). Сохраните keystore в защищённом хранилище: при его
потере придётся сбрасывать upload key через поддержку Google.

Ручной шаг: требует аккаунта Expo и/или Google.

## 5. Google Play App Signing

При первой загрузке AAB в Play Console Google показывает блок **App signing by Google Play** —
нужно нажать **Continue**. После этого:

- Google генерирует и хранит **app signing key** (ключ, которым подписываются APK для устройств);
- EAS-keystore становится **upload key** — им подписывается AAB перед загрузкой;
- потеря/компрометация upload key лечится сбросом через поддержку Google, потеря app signing key — нет.

Мы **не** загружаем keystore в Play вручную: upload key известен только EAS, Play проверяет подпись
загруженного AAB. Если понадобится перенести ключ в Google (смена ключа), существует процедура
«reset upload key» с `pem`-сертификатом, экспортированным через `keytool` (см. официальную
документацию Expo: <https://docs.expo.dev/app-signing/app-credentials/>).

Ручной шаг: первый AAB загружается в Play Console (через `eas submit` или вручную), и там
подтверждается App Signing.

## 6. Сборка AAB для Google Play

Профиль `production` в `eas.json`:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

```sh
eas build --platform android --profile production
```

- результат — **AAB** (`android.buildType: "app-bundle"`), именно его требует Google Play для новых
  приложений и обновлений;
- `autoIncrement: true` при `cli.appVersionSource: "remote"` увеличивает `versionCode` автоматически
  на каждом билде (см. раздел 8);
- сборка выполняется на серверах Expo, локальный Android SDK не нужен;
- прогресс и артефакт — в expo.dev (или ссылка в выводе CLI).

Внутренняя проверка сборки (APK для тестирования на устройстве):

```sh
eas build --platform android --profile preview
```

Профиль `preview` отдаёт APK (`distribution: "internal"`, `buildType: "apk"`) и **не** инкрементит
`versionCode`. APK нельзя загружать в Google Play.

## 7. Публикация в Google Play (`eas submit`)

```sh
eas submit --platform android --profile production
```

- требуется Google service account key (раздел 4) и существующее приложение в Play Console;
- первый `eas submit` создаёт релиз в **internal testing track**; чтобы не запускать раскатку сразу,
  добавьте `"releaseStatus": "draft"` в `submit.production` в `eas.json`;
- сборку и сабмит можно объединить: `eas build -p android --profile production --auto-submit`;
- если Play API не используется, AAB можно загрузить в Play Console вручную (**Production → Create new
  release** → upload AAB). Это ручной шаг, требующий аккаунта Google Play.

Минимальный `submit.production` в `eas.json` (`{}`) означает «все настройки по умолчанию, ключ
сервисного аккаунта привязан к приложению на стороне Expo».

## 8. Версионирование

В `eas.json` включён удалённый источник версий:

```json
{
  "cli": {
    "appVersionSource": "remote",
    "version": ">= 16.0.0"
  }
}
```

- **`version`** (`1.0.0` в app.json) — user-facing `versionName`, обновляется **вручную** при
  подготовке релиза. `autoIncrement` не меняет `version`.
- **`android.versionCode`** — developer-facing номер сборки. При `appVersionSource: "remote"` значение
  хранится на серверах Expo. Оно инициализируется из app.json (`versionCode: 1`), а первый
  production-билд с `autoIncrement: true` получит `2`; дальше номер растёт сам, и Play не отклонит
  дубликат.
- Значение `android.versionCode` в app.json после инициализации remote-источника игнорируется при
  сборке; менять его вручную не нужно.
- Полезные команды:
  - `eas build:version:set` — задать/синхронизировать remote `versionCode` (например, чтобы продолжить
    нумерацию после релиза в Play);
  - `eas build:version:sync` — подтянуть remote-значение в локальную конфигурацию для локальных сборок.

## 9. CI

GitHub Actions workflow `.github/workflows/ci.yml` проверяет качество и валидность нативной
конфигурации:

- job `quality`: typecheck, lint, format-check, unit-тесты;
- job `android-config`: `npm ci`, `npx expo prebuild --platform android --no-install`,
  `npx expo config --type public` — ловит ошибки config-плагинов и app.json до EAS-сборки.

CI **не** собирает AAB и не публикует приложение: для этого нужны аккаунты Expo/Google и секреты
(`EXPO_TOKEN`, service account key), которые в репозитории не хранятся.

## 10. Что делается только вручную

1. Регистрация аккаунта Expo, `eas login`.
2. `eas init` (создание проекта EAS, `extra.eas.projectId`).
3. `eas credentials -p android` (генерация/загрузка upload keystore, Google service account key).
4. Создание приложения в Google Play Console и подтверждение **Play App Signing**.
5. Заполнение листинга Play: название, описания, иконка 512×512 (`assets/images/store-icon.png`),
   feature graphic 1024×500 (`docs/play/feature-graphic.png`), скриншоты, категория, возрастной
   рейтинг, Data safety, политика конфиденциальности.
6. Загрузка AAB и раскатка по трекам (internal → closed → production), либо настройка `eas submit`.
7. Хранение keystore и ключей в защищённом месте; ротация/сброс при компрометации.

## 11. Риски и частые ошибки

- **AAB vs APK**: в Play загружается только `.aab`; `preview`-профиль с APK — только для тестов.
- **`versionCode`**: должен монотонно расти. С `appVersionSource: "remote"` не редактируйте его в
  app.json вручную после первой сборки — иначе можно получить конфликт с серверным значением.
- **`package` (`com.jkwef.playnow`) неизменяем после публикации** в Play.
- **Keystore**: потеря upload key — сброс через поддержку Google; локальные копии keystore не
  коммитить.
- **Плагины Expo**: ошибки в `app.json`/`plugins` всплывают на `expo prebuild`; поэтому в CI есть
  job `android-config`, а локально конфиг проверяется через `@expo/config` (команда `npx expo config`
  в песочнице может зависать).
- **Права**: `android.blockedPermissions` удаляет лишние разрешения из манифеста (SYSTEM_ALERT_WINDOW,
  VIBRATE, READ/WRITE_EXTERNAL_STORAGE). Проверяйте итоговый `AndroidManifest.xml` в
  `android/app/src/main/` после prebuild.
- **Environment-переменные**: `.env` не коммитится; EAS-сборка должна получать только публичные
  `EXPO_PUBLIC_*`/`extra`-значения. Секреты (`STEAM_API_KEY`, `RAWG_API_KEY`) живут в Supabase Edge
  Functions и в клиент не попадают.

## 12. Полезные ссылки

- Expo Build: <https://docs.expo.dev/build/introduction/>
- eas.json reference: <https://docs.expo.dev/build/eas-json/>
- Управление версиями: <https://docs.expo.dev/build-reference/app-versions/>
- Android credentials и App Signing: <https://docs.expo.dev/app-signing/app-credentials/>
- Expo Submit для Android: <https://docs.expo.dev/submit/android/>
