/** Сведения о приложении для экрана настроек (FR6.1). */
export interface AppInfo {
  /** Версия из app.json (expo.version), например «1.0.0». */
  version: string;
  /** Адрес политики конфиденциальности или null, если не задан или небезопасен. */
  privacyPolicyUrl: string | null;
}

/** Часть ExpoConfig, которая нам нужна: так функцию легко проверить без expo-constants. */
export interface AppConfigLike {
  version?: string;
  extra?: Record<string, unknown>;
}

const HTTPS_URL_RE = /^https:\/\/[^\s/?#@]+(\/[^\s]*)?$/;
const MAX_URL_LENGTH = 500;

/** Только https и без логина в адресе: ссылку из конфига открываем во встроенном браузере. */
export const isSafeHttpsUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_URL_LENGTH && HTTPS_URL_RE.test(value);

export const readAppInfo = (config: AppConfigLike | null | undefined): AppInfo => {
  const version = config?.version?.trim();
  const url = config?.extra?.privacyPolicyUrl;
  return {
    version: version !== undefined && version.length > 0 ? version : 'неизвестна',
    privacyPolicyUrl: isSafeHttpsUrl(url) ? url : null,
  };
};
