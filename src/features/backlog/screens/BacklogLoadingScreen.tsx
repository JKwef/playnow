import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { ProgressBar } from '@/shared/components/ProgressBar';
import { Screen } from '@/shared/components/Screen';
import { fontSize } from '@/shared/constants';

import { BacklogErrorView } from '../components/BacklogErrorView';
import { useBacklog } from '../hooks/useBacklog';

/** Сообщение на случай, если код ошибки не пришёл (например, неожиданный сбой). */
const FALLBACK_ERROR = 'Не удалось загрузить список игр';

/**
 * Первый экран после входа (UI2 «Экран загрузки бэклога»).
 * Если бэклог уже есть (в кэше или пришёл из сети), сразу уходим на главный экран.
 */
export function BacklogLoadingScreen({ navigation }: RootStackScreenProps<'BacklogLoading'>) {
  const styles = useThemedStyles(createStyles);

  const { status, games, errorCode, errorMessage, refresh, isRefreshing } = useBacklog();
  const signOut = useAuth((state) => state.signOut);
  const hasGames = games !== undefined && games.length > 0;

  useEffect(() => {
    if (hasGames) {
      // replace: возвращаться кнопкой «Назад» на экран загрузки не нужно.
      navigation.replace('Main');
    }
  }, [hasGames, navigation]);

  if (status === 'error' || (errorCode !== null && !hasGames)) {
    return (
      <Screen withTopInset centered>
        <BacklogErrorView
          code={errorCode ?? 'server'}
          message={errorMessage ?? FALLBACK_ERROR}
          isRetrying={isRefreshing}
          onRetry={() => void refresh()}
          // Если повторить не помогло, пользователь не должен остаться в тупике:
          // можно выйти и попробовать войти снова (навигатор сам покажет вход).
          onSignOut={() => void signOut()}
          // Игры из кэша уже увели бы на Picker через эффект выше; страховка на будущее.
          onContinue={hasGames ? () => navigation.replace('Main') : undefined}
        />
      </Screen>
    );
  }

  if (status === 'ready' && !hasGames) {
    // FR2.6: пустая библиотека Steam. Можно добавить игры вручную.
    return (
      <Screen withTopInset centered>
        <Text accessibilityRole="header" style={styles.title}>
          В библиотеке пока нет игр
        </Text>
        <Text style={styles.subtitle}>Повторите импорт, если вы недавно добавили игры в Steam</Text>
        <Button label="Продолжить" variant="secondary" onPress={() => navigation.replace('Main')} />
        <Button
          label={isRefreshing ? 'Загружаем…' : 'Обновить'}
          variant="tertiary"
          disabled={isRefreshing}
          onPress={() => void refresh()}
        />
        <Button
          label="Добавить игру вручную"
          variant="tertiary"
          onPress={() => navigation.navigate('AddGame')}
        />
      </Screen>
    );
  }

  return (
    <Screen withTopInset centered>
      <BrandLogo animated />
      <Text style={styles.title} accessibilityLiveRegion="polite">
        Собираем твою библиотеку
      </Text>
      <Text style={styles.subtitle}>
        Загрузим игры из Steam. Жанры и обложки подтянутся следом.
      </Text>
      <ProgressBar label="Загружаем ваши игры из Steam" />
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.subtitle,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' },
  });
