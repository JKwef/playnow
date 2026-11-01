import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getEnv } from '@/shared/config/env';
import { fetchWithTimeout } from '@/shared/services/http';
import { base64ToBase64Url, bytesToBase64Url } from '@/shared/utils/base64url';

import { createSteamAuthService, type SteamAuthService } from './steamAuthService';

/** Боевые зависимости сервиса входа. В тестах вместо них передаются фейки. */
export const createDefaultSteamAuth = (): SteamAuthService =>
  createSteamAuthService({
    functionsBaseUrl: `${getEnv().supabaseUrl.replace(/\/+$/, '')}/functions/v1/steam-auth`,
    redirectUrl: Linking.createURL('auth'),
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
