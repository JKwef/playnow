import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCover } from '@/features/backlog/components/GameCover';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { colors, fontSize, radius, spacing } from '@/shared/constants';

import { useBlacklist } from '../hooks/useBlacklist';
import { formatPostponedUntil } from '../utils/postponed';

/** Отложенные игры (FR4.4) с возможностью вернуть игру в подбор раньше 7 дней. */
export function PostponedScreen({ navigation }: RootStackScreenProps<'Postponed'>) {
  const { games } = useBacklog();
  const { postponed, restore } = useBlacklist();

  const items = useMemo(() => {
    const byAppid = new Map((games ?? []).map((game) => [game.appid, game]));
    return [...postponed.entries()]
      .map(([appid, until]) => ({ appid, until, game: byAppid.get(appid) }))
      .sort((a, b) => a.until - b.until);
  }, [games, postponed]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.appid)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={styles.hint}>
              Эти игры не попадают в подбор до указанной даты. Нажмите «Вернуть», чтобы снова
              получать их в результатах.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Отложенных игр нет</Text>
            <Text style={styles.hint}>
              Нажмите «Отложить» на экране результата, чтобы убрать игру из подбора на 7 дней.
            </Text>
            <Button label="К подбору" onPress={() => navigation.navigate('Picker')} />
          </View>
        }
        renderItem={({ item }) => {
          const name = item.game?.name ?? `Игра ${item.appid}`;
          return (
            <Card style={styles.row}>
              <GameCover name={name} uri={item.game?.coverUrl ?? null} style={styles.cover} />
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={styles.until}>{formatPostponedUntil(item.until)}</Text>
              </View>
              <Button
                label="Вернуть"
                variant="secondary"
                accessibilityLabel={`Вернуть «${name}» в подбор`}
                onPress={() => void restore(item.appid)}
              />
            </Card>
          );
        }}
        ItemSeparatorComponent={Separator}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, gap: spacing.sm, flexGrow: 1 },
  hint: { color: colors.textSecondary, fontSize: fontSize.caption + 2 },
  empty: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cover: { width: 96, height: 45, borderRadius: radius.button },
  text: { flex: 1, gap: 4 },
  name: { color: colors.textPrimary, fontSize: fontSize.body, fontWeight: '600' },
  until: { color: colors.textSecondary, fontSize: fontSize.caption + 1 },
  separator: { height: spacing.xs },
});
