import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OptionsModal } from '@/shared/components/OptionsModal';
import { colors, fontSize, radius, spacing } from '@/shared/constants';

import { SORT_OPTIONS, type GenreCount, type SortOption } from '../utils/filterGames';
import { genreLabel } from '../utils/genres';

export interface BacklogToolbarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  availableGenres: readonly GenreCount[];
  selectedGenres: readonly string[];
  onToggleGenre: (genre: string) => void;
  onClearGenres: () => void;
  sort: SortOption;
  onChangeSort: (sort: SortOption) => void;
}

/** Строка поиска и кнопки фильтра по жанрам и сортировки (UI2 «Экран списка игр»). */
export function BacklogToolbar({
  query,
  onChangeQuery,
  availableGenres,
  selectedGenres,
  onToggleGenre,
  onClearGenres,
  sort,
  onChangeSort,
}: BacklogToolbarProps) {
  const [openSheet, setOpenSheet] = useState<'genres' | 'sort' | null>(null);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '';
  const genresLabel = selectedGenres.length === 0 ? 'Все жанры' : `Жанры: ${selectedGenres.length}`;

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Поиск по названию"
          placeholderTextColor={colors.textSecondary}
          style={styles.search}
          accessibilityLabel="Поиск по названию игры"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          maxLength={100}
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => onChangeQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Очистить поиск"
            hitSlop={12}
            style={styles.clear}
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.filters}>
        <Chip
          label={genresLabel}
          active={selectedGenres.length > 0}
          accessibilityHint="Откроет список жанров для фильтра"
          onPress={() => setOpenSheet('genres')}
        />
        <Chip
          label={sortLabel}
          active={false}
          accessibilityHint="Откроет варианты сортировки"
          onPress={() => setOpenSheet('sort')}
        />
      </View>

      <OptionsModal
        visible={openSheet === 'genres'}
        title="Жанры"
        multiple
        options={availableGenres.map(({ genre, count }) => ({
          value: genre,
          label: genreLabel(genre),
          hint: String(count),
        }))}
        selected={selectedGenres}
        onToggle={onToggleGenre}
        onClear={onClearGenres}
        onClose={() => setOpenSheet(null)}
        emptyText="Жанры ещё загружаются из RAWG"
      />
      <OptionsModal
        visible={openSheet === 'sort'}
        title="Сортировка"
        multiple={false}
        options={SORT_OPTIONS}
        selected={[sort]}
        onToggle={(value) => {
          onChangeSort(value);
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
    </View>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  accessibilityHint: string;
  onPress: () => void;
}

function Chip({ label, active, accessibilityHint, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label} ▾
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: spacing.xs },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    paddingHorizontal: spacing.sm,
  },
  search: { flex: 1, minHeight: 48, color: colors.textPrimary, fontSize: fontSize.body },
  clear: { padding: 4 },
  clearText: { color: colors.textSecondary, fontSize: fontSize.body },
  filters: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.secondary },
  chipText: { color: colors.textPrimary, fontSize: fontSize.caption + 2 },
  chipTextActive: { color: colors.secondary },
  pressed: { opacity: 0.8 },
});
