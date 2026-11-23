import type { ThemeColors } from '@/shared/constants/colors';
import { useThemeColors, useThemedStyles } from '@/shared/theme/useTheme';
import { useCallback, useState, type ReactElement } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';

import { spacing } from '@/shared/constants';

import type { Game } from '../types/Game';
import { GAME_CARD_HEIGHT, GameCard } from './GameCard';
import { useFlexibleGameRows } from '@/features/backlog/hooks/useFlexibleGameRows';

const SEPARATOR = spacing.xs;
const ROW_HEIGHT = GAME_CARD_HEIGHT + SEPARATOR;

export interface GameListProps {
  games: readonly Game[];
  onPressGame: (appid: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  ListEmptyComponent?: ReactElement;
  ListHeaderComponent?: ReactElement;
}

const keyExtractor = (game: Game): string => String(game.appid);

/**
 * Виртуализированный список игр (FR3.1, NFR1.1: 500 игр без лагов):
 * фиксированная высота обычных строк + getItemLayout, измеряемые строки
 * для узких экранов и крупного шрифта, мемоизированные карточки,
 * ограниченные окна рендера. Pull-to-refresh обновляет бэклог (FR2.5).
 */
export function GameList({
  games,
  onPressGame,
  refreshing,
  onRefresh,
  ListEmptyComponent,
  ListHeaderComponent,
}: GameListProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [headerHeight, setHeaderHeight] = useState(0);
  const flexible = useFlexibleGameRows();

  const renderItem = useCallback(
    ({ item }: { item: Game }) => <GameCard game={item} onPress={onPressGame} />,
    [onPressGame],
  );

  return (
    <FlatList
      data={games}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={
        flexible
          ? undefined
          : (_, index) => ({
              length: ROW_HEIGHT,
              offset: headerHeight + ROW_HEIGHT * index,
              index,
            })
      }
      ListHeaderComponent={
        ListHeaderComponent ? (
          <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            {ListHeaderComponent}
          </View>
        ) : undefined
      }
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
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
  const styles = useThemedStyles(createStyles);

  return <View style={styles.separator} />;
}

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.sm, flexGrow: 1 },
    separator: { height: SEPARATOR },
  });
