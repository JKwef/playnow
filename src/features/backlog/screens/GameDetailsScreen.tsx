import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useLayoutEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { SteamActions } from '@/features/launch/components/SteamActions';
import { PostponeControls } from '@/features/picker/components/PostponeControls';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Screen } from '@/shared/components/Screen';
import { fontSize, radius } from '@/shared/constants';
import { formatDateTime, formatPlaytime } from '@/shared/utils/format';

import { BacklogErrorView } from '../components/BacklogErrorView';
import { GameCover } from '../components/GameCover';
import { GenreChips } from '../components/GenreChips';
import { GenreEditor } from '../components/GenreEditor';
import { GamePreferenceControls } from '../components/GamePreferenceControls';
import { useBacklog } from '../hooks/useBacklog';

/** Сообщение, если код ошибки не пришёл (неожиданный сбой). */
const FALLBACK_ERROR = 'Не удалось загрузить игру';

/** Детали игры (FR3.5, UI2): большая обложка, название, жанры, время в игре, «Открыть в Steam». */
export function GameDetailsScreen({ route, navigation }: RootStackScreenProps<'GameDetails'>) {
  const styles = useThemedStyles(createStyles);

  const backlog = useBacklog();
  const { games, status } = backlog;
  const signOut = useAuth((state) => state.signOut);
  const game = games?.find((item) => item.appid === route.params.appid);

  useLayoutEffect(() => {
    if (game) navigation.setOptions({ title: game.name });
  }, [game, navigation]);

  if (game === undefined) {
    // Ошибка импорта: вместо вечной загрузки объясняем, что случилось, и даём выход.
    if (status === 'error') {
      return (
        <Screen centered>
          <BacklogErrorView
            code={backlog.errorCode ?? 'server'}
            message={backlog.errorMessage ?? FALLBACK_ERROR}
            isRetrying={backlog.isRefreshing}
            onRetry={() => void backlog.refresh()}
            onSignOut={() => void signOut()}
          />
          <Button
            label="К списку игр"
            variant="tertiary"
            onPress={() => navigation.navigate('Backlog')}
          />
        </Screen>
      );
    }
    return status === 'loading' ? (
      <LoadingIndicator fullScreen label="Загружаем игру" />
    ) : (
      <Screen centered>
        <Text style={styles.title}>Игра не найдена</Text>
        <Text style={styles.secondary}>Возможно, её нет в вашем списке. Обновите список игр.</Text>
        <Button label="К списку игр" onPress={() => navigation.navigate('Backlog')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <GameCover name={game.name} uri={game.coverUrl} style={styles.cover} />
      <Text accessibilityRole="header" style={styles.title}>
        {game.name}
      </Text>
      <Text style={styles.secondary}>Время в игре: {formatPlaytime(game.playtimeMinutes)}</Text>
      {game.lastPlayedAt !== null && (
        <Text style={styles.secondary}>Последний запуск: {formatDateTime(game.lastPlayedAt)}</Text>
      )}
      <GenreChips genres={game.genres} />
      <GenreEditor key={game.appid} game={game} />
      <GamePreferenceControls key={`preferences-${game.appid}`} appid={game.appid} />
      <SteamActions key={game.appid} appid={game.appid} />
      <PostponeControls key={`postpone-${game.appid}`} appid={game.appid} />
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Steam header.jpg — 460×215.
    cover: { width: '100%', aspectRatio: 460 / 215, borderRadius: radius.card },
    title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
    secondary: { color: colors.textSecondary, fontSize: fontSize.body },
    note: { color: colors.textSecondary, fontSize: fontSize.caption + 2, textAlign: 'center' },
  });
