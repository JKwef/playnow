import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/shared/components/Card';
import { colors, fontSize, radius, spacing } from '@/shared/constants';
import { formatPlaytime } from '@/shared/utils/format';

import type { Game } from '../types/Game';
import { genreLabel } from '../utils/genres';
import { GameCover } from './GameCover';

/** Фиксированная высота карточки: FlatList считает позиции без замеров (getItemLayout). */
export const GAME_CARD_HEIGHT = 88;

export interface GameCardProps {
  game: Game;
  onPress: (appid: number) => void;
}

/** Карточка игры в списке: обложка, название, время в игре, жанры (UI2). */
export const GameCard = memo(function GameCard({ game, onPress }: GameCardProps) {
  const playtime = formatPlaytime(game.playtimeMinutes);
  const genres = game.genres.slice(0, 3).map(genreLabel).join(', ');
  return (
    <Card
      onPress={() => onPress(game.appid)}
      style={styles.card}
      accessibilityLabel={`${game.name}. ${playtime}${genres ? `. ${genres}` : ''}`}
      accessibilityHint="Откроет подробности об игре"
    >
      <GameCover name={game.name} uri={game.coverUrl} style={styles.cover} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {game.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {playtime}
          {genres ? ` · ${genres}` : ''}
        </Text>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    height: GAME_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Пропорции обложки Steam header.jpg (460×215).
  cover: { width: 120, height: 56, borderRadius: radius.button },
  text: { flex: 1, gap: 4 },
  name: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: fontSize.caption + 2 },
});
