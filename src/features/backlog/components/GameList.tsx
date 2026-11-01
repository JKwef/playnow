import { useCallback, type ReactElement } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/constants';

import type { Game } from '../types/Game';
import { GAME_CARD_HEIGHT, GameCard } from './GameCard';

const SEPARATOR = spacing.xs;
const ROW_HEIGHT = GAME_CARD_HEIGHT + SEPARATOR;

export interface GameListProps {
  games: readonly Game[];
  onPressGame: (appid: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  ListEmptyComponent?: ReactElement;
}

const keyExtractor = (game: Game): string => String(game.appid);

/**
 * Виртуализированный список игр (FR3.1, NFR1.1: 500 игр без лагов):
 * фиксированная высота строк + getItemLayout, мемоизированные карточки,
 * ограниченные окна рендера. Pull-to-refresh обновляет бэклог (FR2.5).
 */
export function GameList({
  games,
  onPressGame,
  refreshing,
  onRefresh,
  ListEmptyComponent,
}: GameListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Game }) => <GameCard game={item} onPress={onPressGame} />,
    [onPressGame],
  );

  return (
    <FlatList
      data={games}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={9}
      // На Android снимает невидимые строки с отрисовки; на iOS даёт артефакты.
      removeClippedSubviews={Platform.OS === 'android'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.secondary}
          colors={[colors.secondary]}
          progressBackgroundColor={colors.surface}
        />
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.sm, flexGrow: 1 },
  separator: { height: SEPARATOR },
});
