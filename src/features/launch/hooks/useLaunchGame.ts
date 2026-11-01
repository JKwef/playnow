import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  createSteamLauncher,
  LAUNCH_ERROR_MESSAGES,
  LaunchError,
  STEAM_INSTALL_URL,
  type SteamLauncher,
} from '../services/steamLauncher';

const defaultLauncher = createSteamLauncher(Linking);

export interface UseLaunchGameResult {
  /** Открывает игру в Steam; при ошибке показывает понятное сообщение (FR5.2). */
  launch: (appid: number) => Promise<void>;
  isLaunching: boolean;
}

export const useLaunchGame = (launcher: SteamLauncher = defaultLauncher): UseLaunchGameResult => {
  const [isLaunching, setIsLaunching] = useState(false);

  const launch = useCallback(
    async (appid: number) => {
      setIsLaunching(true);
      try {
        await launcher.launch(appid);
      } catch (error) {
        const code = error instanceof LaunchError ? error.code : 'steam_not_installed';
        console.warn('steam launch failed', error);
        Alert.alert(
          'Не получилось запустить',
          LAUNCH_ERROR_MESSAGES[code],
          code === 'steam_not_installed'
            ? [
                { text: 'Закрыть', style: 'cancel' },
                {
                  text: 'Установить Steam',
                  onPress: () => {
                    Linking.openURL(STEAM_INSTALL_URL).catch((openError: unknown) => {
                      console.warn('open Steam install page failed', openError);
                    });
                  },
                },
              ]
            : [{ text: 'Понятно' }],
        );
      } finally {
        setIsLaunching(false);
      }
    },
    [launcher],
  );

  return { launch, isLaunching };
};
