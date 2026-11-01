import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { ProgressBar } from '@/shared/components/ProgressBar';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize } from '@/shared/constants';

import { BacklogErrorView } from '../components/BacklogErrorView';
import { useBacklog } from '../hooks/useBacklog';

/**
 * Первый экран после входа (UI2 «Экран загрузки бэклога»).
 * Если бэклог уже есть (в кэше или пришёл из сети), сразу уходим на главный экран.
 */
export function BacklogLoadingScreen({ navigation }: RootStackScreenProps<'BacklogLoading'>) {
  const { status, games, errorCode, errorMessage, refresh, isRefreshing } = useBacklog();
  const hasGames = games !== undefined && games.length > 0;

  useEffect(() => {
    if (hasGames) {
      // replace: возвращаться кнопкой «Назад» на экран загрузки не нужно.
      navigation.replace('Picker');
    }
  }, [hasGames, navigation]);

  if (status === 'error' && errorCode !== null && errorMessage !== null) {
    return (
      <Screen withTopInset centered>
        <BacklogErrorView
          code={errorCode}
          message={errorMessage}
          isRetrying={isRefreshing}
          onRetry={() => void refresh()}
        />
      </Screen>
    );
  }

  if (status === 'ready' && !hasGames) {
    // FR2.6: пустая библиотека Steam. Можно добавить игры вручную.
    return (
      <Screen withTopInset centered>
        <Text accessibilityRole="header" style={styles.title}>
          У вас нет игр в Steam
        </Text>
        <Text style={styles.subtitle}>Добавьте игры вручную или обновите список позже</Text>
        <Button label="Добавить игру вручную" onPress={() => navigation.navigate('AddGame')} />
        <Button
          label="Продолжить"
          variant="secondary"
          onPress={() => navigation.replace('Picker')}
        />
        <Button
          label={isRefreshing ? 'Загружаем…' : 'Обновить'}
          variant="tertiary"
          disabled={isRefreshing}
          onPress={() => void refresh()}
        />
      </Screen>
    );
  }

  return (
    <Screen withTopInset centered>
      <Text style={styles.title} accessibilityLiveRegion="polite">
        Загружаем ваши игры из Steam...
      </Text>
      <ProgressBar label="Загружаем ваши игры из Steam" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' },
});
