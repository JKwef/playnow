import { useThemeColors } from '@/shared/theme/useTheme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { AddGameScreen } from '@/features/backlog/screens/AddGameScreen';
import { BacklogLoadingScreen } from '@/features/backlog/screens/BacklogLoadingScreen';
import { GameDetailsScreen } from '@/features/backlog/screens/GameDetailsScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { PostponedScreen } from '@/features/picker/screens/PostponedScreen';
import { ResultScreen } from '@/features/picker/screens/ResultScreen';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { MainNavigator } from '@/navigation/MainNavigator';
import { DemoScreen } from '@/features/demo/screens/DemoScreen';
import { RecommendationHistoryScreen } from '@/features/picker/screens/RecommendationHistoryScreen';

import { useAuth } from '@/features/auth/hooks/useAuth';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type RootStackType = typeof Stack;

// Регистрируем стек глобально: useNavigation() и <Link> получают типы маршрутов без дженериков.
declare module '@react-navigation/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends RootStackType {}
}

/**
 * Корневой стек. Зоны «гость» и «авторизован» рендерятся условно, а не через navigate():
 * при входе/выходе React Navigation сам сбрасывает историю, и кнопка «Назад»
 * не вернёт на экран входа (и наоборот). Это рекомендованный паттерн auth flow.
 */
export function RootNavigator() {
  const colors = useThemeColors();

  const status = useAuth((state) => state.status);
  const restoreSession = useAuth((state) => state.restoreSession);

  // Один раз при старте пытаемся поднять сохранённую сессию (FR1.3).
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Пока не знаем, есть ли сохранённая сессия (этап 4: чтение SecureStore), не мигаем экраном входа.
  if (status === 'unknown') {
    return <LoadingIndicator fullScreen label="Загрузка" />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {status !== 'signedIn' ? (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Demo" component={DemoScreen} options={{ title: 'Пример подбора' }} />
        </Stack.Group>
      ) : (
        // После загрузки библиотеки открываются основные вкладки.
        <Stack.Group>
          <Stack.Screen
            name="BacklogLoading"
            component={BacklogLoadingScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="Main" component={MainNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Ваша игра' }} />
          <Stack.Screen
            name="RecommendationHistory"
            component={RecommendationHistoryScreen}
            options={{ title: 'История рекомендаций' }}
          />
          <Stack.Screen
            name="GameDetails"
            component={GameDetailsScreen}
            options={{ title: 'Игра' }}
          />
          <Stack.Screen
            name="AddGame"
            component={AddGameScreen}
            options={{ title: 'Новая игра' }}
          />
          <Stack.Screen
            name="Postponed"
            component={PostponedScreen}
            options={{ title: 'Отложенные' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
