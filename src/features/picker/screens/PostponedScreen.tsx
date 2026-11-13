import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameCover } from '@/features/backlog/components/GameCover';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { fontSize, radius, spacing } from '@/shared/constants';

import { useBlacklist } from '../hooks/useBlacklist';
import { formatPostponedUntil } from '../utils/postponed';

/** Отложенные игры (FR4.4) с возможностью вернуть игру в подбор раньше 7 дней. */
export function PostponedScreen({ navigation }: RootStackScreenProps<'Postponed'>) {
  const styles = useThemedStyles(createStyles);

  const { games } = useBacklog();
  const { postponed, restore, errorMessage, retry } = useBlacklist();
  const [pending, setPending] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const restoreGame = async (appid: number) => {
    if (pending !== null) return;
    setPending(appid);
    setActionError(null);
    try {
      await restore(appid);
    } catch {
      setActionError('Не удалось вернуть игру. Попробуйте ещё раз.');
    } finally {
      setPending(null);
    }
  };

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
          <>
            {(errorMessage || actionError) && (
              <Text accessibilityRole="alert" style={styles.hint}>
                {actionError ?? errorMessage}
              </Text>
            )}
            {errorMessage && (
              <Button label="Повторить" variant="secondary" onPress={() => void retry()} />
            )}
            {items.length > 0 && (
              <Text style={styles.hint}>
                Эти игры не попадают в подбор до указанной даты. Нажмите «Вернуть», чтобы снова
                получать их в результатах.
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Отложенных игр нет</Text>
            <Text style={styles.hint}>
              На экране результата или в карточке игры выберите «До завтра» или «На неделю».
            </Text>
            <Button
              label="К подбору"
              onPress={() => navigation.popTo('Main', { screen: 'Picker' })}
            />
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
                disabled={pending !== null}
                variant="secondary"
                accessibilityLabel={`Вернуть «${name}» в подбор`}
                onPress={() => void restoreGame(item.appid)}
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
  const styles = useThemedStyles(createStyles);

  return <View style={styles.separator} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
