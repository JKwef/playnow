import { useLayoutEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useLaunchGame } from '@/features/launch/hooks/useLaunchGame';
import { useBlacklist } from '@/features/picker/hooks/useBlacklist';
import { formatPostponedUntil } from '@/features/picker/utils/postponed';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, radius } from '@/shared/constants';
import { formatDateTime, formatPlaytime } from '@/shared/utils/format';

import { GameCover } from '../components/GameCover';
import { GenreChips } from '../components/GenreChips';
import { useBacklog } from '../hooks/useBacklog';
import { isManualAppId } from '../utils/manualGame';

/** Детали игры (FR3.5, UI2): большая обложка, название, жанры, время в игре, «Играть». */
export function GameDetailsScreen({ route, navigation }: RootStackScreenProps<'GameDetails'>) {
  const { games, status } = useBacklog();
  const game = games?.find((item) => item.appid === route.params.appid);
  const { launch, isLaunching } = useLaunchGame();
  const { postponed, restore } = useBlacklist();

  useLayoutEffect(() => {
    if (game) navigation.setOptions({ title: game.name });
  }, [game, navigation]);

  if (game === undefined) {
    return status === 'loading' ? (
      <LoadingIndicator fullScreen label="Загружаем игру" />
    ) : (
      <Screen centered>
        <Text style={styles.title}>Игра не найдена</Text>
        <Text style={styles.secondary}>Возможно, её нет в вашем списке. Обновите список игр.</Text>
        <Button label="К списку игр" onPress={() => navigation.navigate('Backlog')} />
      </Screen>
    );
  }

  const manual = isManualAppId(game.appid);
  const postponedUntil = postponed.get(game.appid);

  return (
    <Screen>
      <GameCover name={game.name} uri={game.coverUrl} style={styles.cover} />
      <Text accessibilityRole="header" style={styles.title}>
        {game.name}
      </Text>
      <Text style={styles.secondary}>Время в игре: {formatPlaytime(game.playtimeMinutes)}</Text>
      {game.lastPlayedAt !== null && (
        <Text style={styles.secondary}>Последний запуск: {formatDateTime(game.lastPlayedAt)}</Text>
      )}
      <GenreChips genres={game.genres} />
      <Button
        label={isLaunching ? 'Открываем Steam…' : 'Играть'}
        accessibilityHint="Запустит игру в Steam"
        disabled={manual || isLaunching}
        onPress={() => void launch(game.appid)}
      />
      {manual && (
        <Text style={styles.note}>
          Игра добавлена вручную без Steam, поэтому запустить её из приложения нельзя.
        </Text>
      )}
      {postponedUntil !== undefined && (
        <>
          <Text style={styles.note}>{formatPostponedUntil(postponedUntil)}</Text>
          <Button
            label="Вернуть в подбор"
            variant="tertiary"
            onPress={() => void restore(game.appid)}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Steam header.jpg — 460×215.
  cover: { width: '100%', aspectRatio: 460 / 215, borderRadius: radius.card },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  secondary: { color: colors.textSecondary, fontSize: fontSize.body },
  note: { color: colors.textSecondary, fontSize: fontSize.caption + 2, textAlign: 'center' },
});
