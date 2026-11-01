import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './types';

/** Превращает строковый параметр URL в положительное целое (appid), иначе 0. */
const parseAppId = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Deep link'и вида playnow://games/730.
 * Ссылка на экран из закрытой зоны, пока пользователь не вошёл, просто откроет Login:
 * React Navigation сопоставляет путь только с экранами, которые сейчас отрендерены.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'playnow://'],
  // Редирект после входа в Steam (playnow://auth?code=…) забирает openAuthSessionAsync.
  // На Android он может прийти и в обычный Linking: навигации он не касается.
  filter: (url) => !/(?:\/\/|\/--\/)auth(?:[?#]|$)/.test(url),
  config: {
    screens: {
      Login: 'login',
      Picker: '',
      Backlog: 'games',
      GameDetails: {
        path: 'games/:appid',
        parse: { appid: parseAppId },
      },
      AddGame: 'games/new',
      Postponed: 'postponed',
      Result: 'result/:contextId',
      Settings: 'settings',
    },
  },
};
