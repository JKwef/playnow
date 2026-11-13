import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { StyleSheet, Text, View } from 'react-native';

import { GameCover } from '@/features/backlog/components/GameCover';
import { GenreChips } from '@/features/backlog/components/GenreChips';
import type { Game } from '@/features/backlog/types/Game';
import { fontSize, radius, spacing } from '@/shared/constants';
import { formatPlaytime } from '@/shared/utils/format';

export function GameResult({ game }: { game: Game }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <GameCover name={game.name} uri={game.coverUrl} style={styles.cover} />
      <View style={styles.body}>
        <Text style={styles.eyebrow}>ТВОЙ ВЫБОР НА СЕГОДНЯ</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {game.name}
        </Text>
        <GenreChips genres={game.genres} />
        <View style={styles.reason}>
          <Text style={styles.reasonTitle}>
            {game.playtimeMinutes === 0
              ? 'Самое время начать'
              : game.playtimeMinutes < 120
                ? 'Дай этой игре ещё один шанс'
                : 'Знакомый мир, новое приключение'}
          </Text>
          <Text style={styles.playtime}>
            {game.playtimeMinutes === 0
              ? 'По данным Steam, ты ещё не проводил время в этой игре.'
              : `Всего в игре: ${formatPlaytime(game.playtimeMinutes)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cover: { width: '100%', aspectRatio: 460 / 215 },
    body: { padding: spacing.sm, gap: 14 },
    eyebrow: { color: colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.title,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    reason: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, gap: 6 },
    reasonTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    playtime: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  });
