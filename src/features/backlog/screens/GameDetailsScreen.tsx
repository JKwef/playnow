import { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, radius, spacing } from '@/shared/constants';
import { formatDateTime, formatPlaytime } from '@/shared/utils/format';

import { GameCover } from '../components/GameCover';
import { useBacklog } from '../hooks/useBacklog';
import { genreLabel } from '../utils/genres';
import { isManualAppId } from '../utils/manualGame';

/** Детали игры (FR3.5, UI2): большая обложка, название, жанры, время в игре, «Играть». */
export function GameDetailsScreen({ route, navigation }: RootStackScreenProps<'GameDetails'>) {
  const { games, status } = useBacklog();
  const game = games?.find((item) => item.appid === route.params.appid);

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
      {game.genres.length > 0 ? (
        <View
          style={styles.genres}
          accessibilityLabel={`Жанры: ${game.genres.map(genreLabel).join(', ')}`}
        >
          {game.genres.map((genre) => (
            <View key={genre} style={styles.genre}>
              <Text style={styles.genreText}>{genreLabel(genre)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.secondary}>Жанры не определены</Text>
      )}
      {/* Запуск через steam://run/<appid> и обработку «Steam не установлен» подключим на этапе 9. */}
      <Button label="Играть" accessibilityHint="Запустит игру в Steam" disabled />
      <Text style={styles.note}>
        {manual
          ? 'Игра добавлена вручную без Steam, поэтому запустить её из приложения нельзя.'
          : 'Запуск через Steam появится на этапе 9.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Steam header.jpg — 460×215.
  cover: { width: '100%', aspectRatio: 460 / 215, borderRadius: radius.card },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  secondary: { color: colors.textSecondary, fontSize: fontSize.body },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  genre: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreText: { color: colors.textPrimary, fontSize: fontSize.caption + 2 },
  note: { color: colors.textSecondary, fontSize: fontSize.caption + 2, textAlign: 'center' },
});
