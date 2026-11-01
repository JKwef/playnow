import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getEnv } from '@/shared/config/env';
import { fetchWithTimeout } from '@/shared/services/http';
import { base64ToBase64Url, bytesToBase64Url } from '@/shared/utils/base64url';

import { createSteamAuthService, type SteamAuthService } from './steamAuthService';

/**
 * Адрес, на который функция вернёт пользователя после входа.
 * В сборке это playnow://auth. В Expo Go своя схема не зарегистрирована, поэтому
 * нужен exp://<адрес dev-сервера>/--/auth. createURL обычно сам это учитывает,
 * но если он вернул кастомную схему внутри Expo Go, собираем адрес вручную:
 * иначе браузер не сможет вернуть пользователя в приложение.
 */
const resolveRedirectUrl = (): string => {
  const url = Linking.createURL('auth');
  // Разные версии Expo Go по-разному сообщают о себе, поэтому проверяем все признаки.
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo' ||
    Constants.expoGoConfig !== null;
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (inExpoGo && !/^exps?:\/\//.test(url) && hostUri) {
    return `exp://${hostUri.replace(/\/+$/, '')}/--/auth`;
  }
  return url;
};

/** Боевые зависимости сервиса входа. В тестах вместо них передаются фейки. */
export const createDefaultSteamAuth = (): SteamAuthService =>
  createSteamAuthService({
    functionsBaseUrl: `${getEnv().supabaseUrl.replace(/\/+$/, '')}/functions/v1/steam-auth`,
    redirectUrl: resolveRedirectUrl(),
    openAuthSession: (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl),
    // 32 байта энтропии → 43 символа base64url, минимум по RFC 7636.
    createVerifier: () => bytesToBase64Url(Crypto.getRandomBytes(32)),
    sha256Base64Url: async (input) =>
      base64ToBase64Url(
        await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
          encoding: Crypto.CryptoEncoding.BASE64,
        }),
      ),
    fetch: fetchWithTimeout,
  });
