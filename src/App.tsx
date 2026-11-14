import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { fontFamily } from '@/shared/constants';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { linking } from '@/navigation/linking';
import { bindAccountQueries } from '@/features/auth/services/accountQueries';
import { RootNavigator } from '@/navigation/RootNavigator';
import { createNavigationTheme } from '@/navigation/theme';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { themeColorScheme, useTheme } from '@/shared/theme/useTheme';
import { PickerSyncBridge } from '@/features/picker/hooks/usePickerSync';

// Веб-версия (проверка на ПК): вход через Steam идёт во всплывающем окне, которое
// возвращается на /auth. Этот вызов передаёт результат открывшему окну и закрывает
// всплывающее. На iOS/Android ничего не делает.
WebBrowser.maybeCompleteAuthSession();

/**
 * Корень приложения: провайдеры в порядке «снаружи внутрь».
 * QueryClient создаётся в useState, чтобы не пересоздаваться при ре-рендерах
 * и не жить в глобальной области (проще изолировать в тестах).
 */
export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Детальная настройка (оффлайн, ретраи, таймауты) на этапе 5.
          queries: { retry: 1, staleTime: 5 * 60 * 1000 },
        },
      }),
  );

  useEffect(() => bindAccountQueries(queryClient), [queryClient]);

  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: require('../assets/fonts/Inter-Regular.ttf'),
    [fontFamily.display]: require('../assets/fonts/RussoOne-Regular.ttf'),
    [fontFamily.bold]: require('../assets/fonts/Inter-Bold.ttf'),
  });
  if (!fontsLoaded && !fontError) return <LoadingIndicator fullScreen />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PickerSyncBridge />
          <ThemedNavigation />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedNavigation() {
  const { mode, colors } = useTheme();
  const colorScheme = themeColorScheme(mode);
  const navigationTheme = useMemo(() => createNavigationTheme(mode, colors), [mode, colors]);
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(colorScheme);
    void SystemUI.setBackgroundColorAsync(colors.background).catch((error: unknown) =>
      console.warn('system background update failed', error),
    );
  }, [colors.background, colorScheme]);
  return (
    <>
      <NavigationContainer
        theme={navigationTheme}
        linking={linking}
        fallback={<LoadingIndicator fullScreen />}
      >
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </>
  );
}
