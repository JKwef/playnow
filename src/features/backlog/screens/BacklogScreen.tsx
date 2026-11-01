import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { colors, fontSize, spacing } from '@/shared/constants';
import { formatDateTime, formatPlaytime } from '@/shared/utils/format';

import { useBacklog } from '../hooks/useBacklog';

/**
 * Список игр. ВРЕМЕННАЯ версия этапов 5–6: строка на игру (с жанрами из RAWG) и «Обновить» (FR2.5).
 * Карточки с обложками, поиск, фильтры и сортировка будут на этапе 7.
 */
export function BacklogScreen({ navigation }: RootStackScreenProps<'Backlog'>) {
  const {
    games,
    updatedAt,
    isFromCache,
    isRefreshing,
    errorMessage,
    genresStatus,
    genresRemaining,
    refresh,
  } = useBacklog();

  if (games === undefined) {
    return <LoadingIndicator fullScreen label="Загружаем игры" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.meta}>
          {games.length} игр{updatedAt ? ` · обновлено ${formatDateTime(updatedAt)}` : ''}
        </Text>
        {genresStatus === 'loading' && (
          <Text style={styles.meta} accessibilityLiveRegion="polite">
            Определяем жанры
            {genresRemaining !== null && genresRemaining > 0
              ? `: осталось ${genresRemaining}`
              : '…'}
          </Text>
        )}
        {genresStatus === 'error' && (
          <Text style={styles.meta}>
            Жанры загрузились не для всех игр. Догрузим при следующем обновлении
          </Text>
        )}
        {errorMessage !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
            {isFromCache ? '. Показан сохранённый список' : ''}
          </Text>
        )}
        <Button
          label={isRefreshing ? 'Обновляем…' : 'Обновить'}
          variant="secondary"
          disabled={isRefreshing}
          accessibilityHint="Заново загрузит список игр из Steam"
          onPress={() => void refresh()}
        />
      </View>
      <FlatList
        data={games}
        keyExtractor={(game) => String(game.appid)}
        renderItem={({ item }) => (
          <Button
            label={`${item.name} · ${formatPlaytime(item.playtimeMinutes)}${
              item.genres.length > 0 ? ` · ${item.genres.join(', ')}` : ''
            }`}
            variant="tertiary"
            onPress={() => navigation.navigate('GameDetails', { appid: item.appid })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.sm, gap: spacing.xs },
  meta: { color: colors.textSecondary, fontSize: fontSize.body },
  error: { color: colors.error, fontSize: fontSize.body },
});
