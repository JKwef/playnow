import { StyleSheet, Text } from 'react-native';

import { GameCover } from '@/features/backlog/components/GameCover';
import { GenreChips } from '@/features/backlog/components/GenreChips';
import type { Game } from '@/features/backlog/types/Game';
import { colors, fontSize, radius } from '@/shared/constants';
import { formatPlaytime } from '@/shared/utils/format';

/** Подобранная игра (FR4.3): большая обложка, название, жанры, время в игре. */
export function GameResult({ game }: { game: Game }) {
  return (
    <>
      <GameCover name={game.name} uri={game.coverUrl} style={styles.cover} />
      <Text accessibilityRole="header" style={styles.title}>
        {game.name}
      </Text>
      <GenreChips genres={game.genres} />
      <Text style={styles.playtime}>Время в игре: {formatPlaytime(game.playtimeMinutes)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  // Steam header.jpg — 460×215.
  cover: { width: '100%', aspectRatio: 460 / 215, borderRadius: radius.card },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  playtime: { color: colors.textSecondary, fontSize: fontSize.body },
});
