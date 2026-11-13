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
import { useBlacklist } from '../hooks/useBlacklist';
import type { PostponeDuration } from '../services/blacklist';
import { isPickerMode, PICKER_MODE_LABELS, type PickerContext, type PickerMode } from '../types';
import { findContext } from '../utils/contexts';

/** Сообщение, если код ошибки не пришёл (неожиданный сбой). */
const FALLBACK_ERROR = 'Не удалось загрузить ваш список игр';

/** Результат подбора (FR4.3, UI2). */
export function ResultScreen({ route, navigation }: RootStackScreenProps<'Result'>) {
  const styles = useThemedStyles(createStyles);

  const context = findContext(route.params.contextId);
  const mode = route.params.mode ?? 'new';
  const genreFilter = route.params.genreFilter ?? 'context';
  if (
    context === undefined ||
    !isPickerMode(mode) ||
    (genreFilter !== 'context' && genreFilter !== 'any')
  ) {
    // Например, устаревшая ссылка playnow://result/<id>.
    return (
      <Screen centered>
        <Text style={styles.title}>Неизвестные условия подбора</Text>
        <Button label="К выбору контекста" onPress={() => navigation.navigate('Picker')} />
      </Screen>
    );
  }
  return (
    <PickedGame
      key={`${context.id}:${mode}:${genreFilter}`}
      context={context}
      mode={mode}
      ignoreGenres={genreFilter === 'any'}
      onBack={() => navigation.goBack()}
      onOpenPostponed={() => navigation.navigate('Postponed')}
      onOpenLibrary={() => navigation.navigate('Backlog')}
      onChangeGenres={(relaxed) =>
        navigation.replace('Result', {
          contextId: context.id,
          mode,
          genreFilter: relaxed ? 'any' : 'context',
        })
      }
    />
  );
}

interface PickedGameProps {
  context: PickerContext;
  onBack: () => void;
  onOpenPostponed: () => void;
  mode: PickerMode;
  ignoreGenres: boolean;
  onOpenLibrary: () => void;
  onChangeGenres: (relaxed: boolean) => void;
}

function PickedGame({
  context,
  mode,
  ignoreGenres,
  onBack,
  onOpenPostponed,
  onOpenLibrary,
  onChangeGenres,
}: PickedGameProps) {
  const styles = useThemedStyles(createStyles);

  const [isPostponing, setIsPostponing] = useState(false);
  const [lastPostponed, setLastPostponed] = useState<{
    appid: number;
    name: string;
    steamId: string | null;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const { restore } = useBlacklist();
  const {
    status,
    game,
    postponedCount,
    excludedCount,
    actionError,
    next,
    postpone,
    isLastOption,
    errorCode,
    errorMessage,
    isRetrying,
    refresh,
    reasons,
    isSeriesExhausted,
    restart,
    emptyReason,
    canRelaxGenres,
    metadataIncomplete,
    metadataMessage,
    libraryEmpty,
    retryMetadata,
    isRetryingMetadata,
  } = useGamePicker(context, { mode, ignoreGenres });
  const { launch, isLaunching } = useLaunchGame();
  const signOut = useAuth((state) => state.signOut);
  const postponeGame = async (duration: PostponeDuration) => {
    if (!game || isPostponing) return;
    const selectedGame = game;
    setIsPostponing(true);
    setRestoreError(null);
    try {
      if (await postpone(duration))
        setLastPostponed({ appid: selectedGame.appid, name: selectedGame.name, steamId });
    } finally {
      setIsPostponing(false);
    }
  };
  const undoPostpone = async () => {
    if (!lastPostponed || isPostponing || lastPostponed.steamId !== steamId) return;
    setIsPostponing(true);
    setRestoreError(null);
    try {
      await restore(lastPostponed.appid);
      setLastPostponed(null);
    } catch {
      setRestoreError('Не удалось отменить откладывание. Попробуйте ещё раз.');
    } finally {
      setIsPostponing(false);
    }
  };
  const feedback = (
    <>
      {lastPostponed && lastPostponed.steamId === steamId && (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            «{lastPostponed.name}» отложена
          </Text>
          <Button
            label="Отменить откладывание"
            variant="secondary"
            disabled={isPostponing}
            onPress={() => void undoPostpone()}
          />
        </>
      )}
      {(actionError || restoreError) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {restoreError ?? actionError}
        </Text>
      )}
    </>
  );

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
          {isSeriesExhausted ? 'Все подходящие игры в этой серии показаны' : emptyReason}
        </Text>
        <Text style={styles.secondary}>
          Режим «{PICKER_MODE_LABELS[mode]}».{' '}
          {ignoreGenres
            ? 'Фильтр жанров отключён'
            : `Жанры контекста: ${context.genres.map(genreLabel).join(', ')}`}
          .{postponedCount > 0 ? ` Отложено игр: ${postponedCount}.` : ''}
          {excludedCount > 0
            ? ` Пройдено или исключено: ${excludedCount}. Вернуть игры можно из их карточек в библиотеке.`
            : ''}
        </Text>
        {feedback}
        {errorMessage && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        )}
        {metadataMessage && (
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {metadataMessage}
          </Text>
        )}
        {libraryEmpty && (
          <Button
            label={isRetrying ? 'Загружаем библиотеку…' : 'Повторить импорт библиотеки'}
            disabled={isRetrying}
            onPress={() => void refresh()}
          />
        )}
        {isSeriesExhausted && <Button label="Начать новый круг" onPress={restart} />}
        <Button label="Изменить режим или контекст" onPress={onBack} />
        <Button
          label="Проверить статусы и исключения в библиотеке"
          variant="secondary"
          onPress={onOpenLibrary}
        />
        {metadataIncomplete && (
          <Button
            label={isRetryingMetadata ? 'Загружаем жанры…' : 'Повторить загрузку метаданных'}
            variant="secondary"
            disabled={isRetryingMetadata}
            onPress={() => void retryMetadata()}
          />
        )}
        {canRelaxGenres && (
          <Button
            label="Любая игра без фильтра жанров"
            variant="secondary"
            onPress={() => onChangeGenres(true)}
          />
        )}
        {ignoreGenres && (
          <Button
            label="Вернуть фильтр жанров"
            variant="tertiary"
            onPress={() => onChangeGenres(false)}
          />
        )}
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
        {PICKER_MODE_LABELS[mode]} · {context.icon} {context.title}
      </Text>
      {ignoreGenres && (
        <>
          <Text style={styles.note}>
            Любая игра без фильтра жанров. Режим и исключения сохранены.
          </Text>
          <Button
            label="Вернуть фильтр жанров"
            variant="tertiary"
            onPress={() => onChangeGenres(false)}
          />
        </>
      )}
      <GameResult game={game} reasons={reasons} />
      <Button
        label={isLaunching ? 'Открываем Steam…' : 'Открыть в Steam'}
        accessibilityHint="Откроет Steam с этой игрой"
        disabled={manual || isLaunching}
        onPress={() => void launch(game.appid)}
      />
      <Button
        label={isSeriesExhausted ? 'Начать новый круг' : 'Показать другую игру'}
        variant="secondary"
        disabled={isPostponing}
        accessibilityHint={
          isSeriesExhausted
            ? 'Начнёт новую серию; игры могут повториться'
            : 'Подберёт ещё не показанную игру под эти условия'
        }
        onPress={isSeriesExhausted ? restart : next}
      />
      <Text style={styles.note}>Не сейчас · отложить на этом устройстве</Text>
      <Button
        label="До завтра"
        variant="tertiary"
        disabled={isPostponing}
        onPress={() => void postponeGame('tomorrow')}
      />
      <Button
        label="На неделю"
        variant="tertiary"
        disabled={isPostponing}
        onPress={() => void postponeGame('week')}
      />
      {feedback}
      {isSeriesExhausted && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Все подходящие игры в этой серии показаны. Новый круг начнётся только по нажатию кнопки.
        </Text>
      )}
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
    error: { color: colors.error, fontSize: fontSize.caption + 2 },
  });
