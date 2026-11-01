import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { BacklogScreen } from '@/features/backlog/screens/BacklogScreen';
import { BacklogLoadingScreen } from '@/features/backlog/screens/BacklogLoadingScreen';
import { GameDetailsScreen } from '@/features/backlog/screens/GameDetailsScreen';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { PickerScreen } from '@/features/picker/screens/PickerScreen';
import { ResultScreen } from '@/features/picker/screens/ResultScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { colors } from '@/shared/constants';
import { useAuth } from '@/shared/hooks/useAuth';

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
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {status !== 'signedIn' ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Picker" component={PickerScreen} options={{ title: 'PlayNow' }} />
          <Stack.Screen
            name="BacklogLoading"
            component={BacklogLoadingScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Ваша игра' }} />
          <Stack.Screen name="Backlog" component={BacklogScreen} options={{ title: 'Мои игры' }} />
          <Stack.Screen
            name="GameDetails"
            component={GameDetailsScreen}
            options={{ title: 'Игра' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Настройки' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
