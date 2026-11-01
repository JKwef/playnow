import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/shared/constants';

import { genreLabel } from '../utils/genres';

/** Жанры игры «плашками». Пустой список — подпись «Жанры не определены». */
export function GenreChips({ genres }: { genres: readonly string[] }) {
  if (genres.length === 0) {
    return <Text style={styles.empty}>Жанры не определены</Text>;
  }
  const labels = genres.map(genreLabel);
  return (
    <View style={styles.row} accessible accessibilityLabel={`Жанры: ${labels.join(', ')}`}>
      {labels.map((label) => (
        <View key={label} style={styles.chip}>
          <Text style={styles.text}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.textPrimary, fontSize: fontSize.caption + 2 },
  empty: { color: colors.textSecondary, fontSize: fontSize.body },
});
