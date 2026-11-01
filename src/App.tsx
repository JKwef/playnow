import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { linking } from '@/navigation/linking';
import { RootNavigator } from '@/navigation/RootNavigator';
import { navigationTheme } from '@/navigation/theme';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';

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

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer
          theme={navigationTheme}
          linking={linking}
          fallback={<LoadingIndicator fullScreen />}
        >
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
