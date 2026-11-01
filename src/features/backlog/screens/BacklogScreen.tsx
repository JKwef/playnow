import { useCallback, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { colors, fontSize, spacing } from '@/shared/constants';
import { formatDateTime } from '@/shared/utils/format';

import { BacklogToolbar } from '../components/BacklogToolbar';
import { GameList } from '../components/GameList';
import { useBacklog } from '../hooks/useBacklog';
import { useGameFilters } from '../hooks/useGameFilters';
import type { Game } from '../types/Game';

const NO_GAMES: readonly Game[] = [];

/** Список игр (FR3): поиск, фильтр по жанрам, сортировка, переход к деталям, обновление. */
export function BacklogScreen({ navigation }: RootStackScreenProps<'Backlog'>) {
  const backlog = useBacklog();
  const filters = useGameFilters(backlog.games ?? NO_GAMES);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          label="＋"
          variant="tertiary"
          accessibilityLabel="Добавить игру вручную"
          onPress={() => navigation.navigate('AddGame')}
        />
      ),
    });
  }, [navigation]);

  const openGame = useCallback(
    (appid: number) => navigation.navigate('GameDetails', { appid }),
    [navigation],
  );

  if (backlog.games === undefined) {
    return <LoadingIndicator fullScreen label="Загружаем игры" />;
  }

  const total = backlog.games.length;
  const shown = filters.visibleGames.length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <BacklogToolbar
        query={filters.query}
        onChangeQuery={filters.setQuery}
        availableGenres={filters.availableGenres}
        selectedGenres={filters.genres}
        onToggleGenre={filters.toggleGenre}
        onClearGenres={filters.clearGenres}
        sort={filters.sort}
        onChangeSort={filters.setSort}
      />
      <View style={styles.status}>
        <Text style={styles.meta} accessibilityLiveRegion="polite">
          {filters.hasActiveFilters ? `Найдено ${shown} из ${total}` : `Всего игр: ${total}`}
          {backlog.updatedAt ? ` · обновлено ${formatDateTime(backlog.updatedAt)}` : ''}
        </Text>
        {backlog.genresStatus === 'loading' && (
          <Text style={styles.meta}>
            Определяем жанры
            {backlog.genresRemaining !== null && backlog.genresRemaining > 0
              ? `: осталось ${backlog.genresRemaining}`
              : '…'}
          </Text>
        )}
        {backlog.errorMessage !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {backlog.errorMessage}
            {backlog.isFromCache ? '. Показан сохранённый список' : ''}
          </Text>
        )}
      </View>
      <GameList
        games={filters.visibleGames}
        onPressGame={openGame}
        refreshing={backlog.isRefreshing}
        onRefresh={() => void backlog.refresh()}
        ListEmptyComponent={
          filters.hasActiveFilters ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Ничего не найдено</Text>
              <Text style={styles.meta}>Измените запрос или выберите другие жанры</Text>
              <Button label="Сбросить фильтры" variant="secondary" onPress={filters.reset} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Список пуст</Text>
              <Text style={styles.meta}>Добавьте игру вручную или обновите список из Steam</Text>
              <Button label="Добавить игру" onPress={() => navigation.navigate('AddGame')} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  status: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, gap: 4 },
  meta: { color: colors.textSecondary, fontSize: fontSize.caption + 2 },
  error: { color: colors.error, fontSize: fontSize.caption + 2 },
  empty: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
});
