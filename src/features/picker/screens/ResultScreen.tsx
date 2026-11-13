import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { BacklogErrorView } from '@/features/backlog/components/BacklogErrorView';
import { genreLabel } from '@/features/backlog/utils/genres';
import { isManualAppId } from '@/features/backlog/utils/manualGame';
import { useLaunchGame } from '@/features/launch/hooks/useLaunchGame';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Screen } from '@/shared/components/Screen';
import { fontSize } from '@/shared/constants';

import { GameResult } from '../components/GameResult';
import { useGamePicker } from '../hooks/useGamePicker';
import { POSTPONE_DAYS } from '../services/blacklist';
import type { PickerContext } from '../types';
import { findContext } from '../utils/contexts';

/** Сообщение, если код ошибки не пришёл (неожиданный сбой). */
const FALLBACK_ERROR = 'Не удалось загрузить ваш список игр';

/** Результат подбора (FR4.3, UI2). */
export function ResultScreen({ route, navigation }: RootStackScreenProps<'Result'>) {
  const styles = useThemedStyles(createStyles);

  const context = findContext(route.params.contextId);
  if (context === undefined) {
    // Например, устаревшая ссылка playnow://result/<id>.
    return (
      <Screen centered>
        <Text style={styles.title}>Неизвестный контекст</Text>
        <Button label="К выбору контекста" onPress={() => navigation.navigate('Picker')} />
      </Screen>
    );
  }
  return (
    <PickedGame
      context={context}
      onBack={() => navigation.goBack()}
      onOpenPostponed={() => navigation.navigate('Postponed')}
    />
  );
}

interface PickedGameProps {
  context: PickerContext;
  onBack: () => void;
  onOpenPostponed: () => void;
}

function PickedGame({ context, onBack, onOpenPostponed }: PickedGameProps) {
  const styles = useThemedStyles(createStyles);

  const [isPostponing, setIsPostponing] = useState(false);
  const {
    status,
    game,
    postponedCount,
    next,
    postpone,
    isLastOption,
    errorCode,
    errorMessage,
    isRetrying,
    refresh,
  } = useGamePicker(context);
  const { launch, isLaunching } = useLaunchGame();
  const signOut = useAuth((state) => state.signOut);

  // Бэклог не загрузился: не крутим спиннер вечно, объясняем причину и даём выход.
  if (status === 'error') {
    return (
      <Screen centered>
        <BacklogErrorView
          code={errorCode ?? 'server'}
          message={errorMessage ?? FALLBACK_ERROR}
          isRetrying={isRetrying}
          onRetry={() => void refresh()}
          onSignOut={() => void signOut()}
        />
        <Button label="К выбору контекста" variant="tertiary" onPress={onBack} />
      </Screen>
    );
  }

  if (status === 'loading') {
    return <LoadingIndicator fullScreen label="Подбираем игру" />;
  }

  if (status === 'empty' || game === null) {
    return (
      <Screen centered>
        <Text accessibilityRole="header" style={styles.title}>
          Нет игр под этот контекст. Попробуйте другой
        </Text>
        <Text style={styles.secondary}>
          Нужны игры с жанрами: {context.genres.map(genreLabel).join(', ')}
          {context.maxPlaytimeMinutes !== undefined
            ? ` и временем в игре меньше ${context.maxPlaytimeMinutes} мин`
            : ''}
          .{postponedCount > 0 ? ` Отложено игр: ${postponedCount}.` : ''}
        </Text>
        <Button label="Выбрать другой контекст" onPress={onBack} />
        {postponedCount > 0 && (
          <Button label="Отложенные игры" variant="tertiary" onPress={onOpenPostponed} />
        )}
      </Screen>
    );
  }

  const manual = isManualAppId(game.appid);
  return (
    <Screen>
      <Text style={styles.context}>
        {context.icon} {context.title}
      </Text>
      <GameResult game={game} />
      <Button
        label={isLaunching ? 'Открываем Steam…' : 'Открыть в Steam'}
        accessibilityHint="Откроет Steam с этой игрой"
        disabled={manual || isLaunching}
        onPress={() => void launch(game.appid)}
      />
      <Button
        label="Показать другую игру"
        variant="secondary"
        disabled={isLastOption || isPostponing}
        accessibilityHint="Подберёт другую игру под этот контекст"
        onPress={next}
      />
      <Button
        label={isPostponing ? 'Откладываем…' : 'Не сейчас · отложить на 7 дней'}
        variant="tertiary"
        disabled={isPostponing}
        accessibilityHint={`Не предлагать эту игру ${POSTPONE_DAYS} дней`}
        onPress={() => {
          setIsPostponing(true);
          void postpone().finally(() => setIsPostponing(false));
        }}
      />
      {isLastOption && <Text style={styles.note}>Это единственная подходящая игра</Text>}
      {manual && (
        <Text style={styles.note}>Игра добавлена вручную, поэтому открыть её в Steam нельзя</Text>
      )}
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
    secondary: { color: colors.textSecondary, fontSize: fontSize.body, textAlign: 'center' },
    context: { color: colors.secondary, fontSize: fontSize.body, fontWeight: '600' },
    note: { color: colors.textSecondary, fontSize: fontSize.caption + 2, textAlign: 'center' },
  });
