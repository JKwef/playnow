import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { spacing } from '@/shared/constants';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { formatDateTime } from '@/shared/utils/format';

import type { UseBacklogResult } from '../hooks/useBacklog';
import { BacklogErrorView } from './BacklogErrorView';

export function BacklogStatusNotice({ backlog }: { backlog: UseBacklogResult }) {
  const styles = useThemedStyles(createStyles);
  const remaining = backlog.genresRemaining;
  const unfinished =
    backlog.genresStatus === 'partial' ||
    backlog.genresStatus === 'error' ||
    backlog.genresStatus === 'idle';
  const unknown = backlog.games?.filter((game) => game.genres.length === 0).length ?? 0;
  return (
    <View style={styles.container}>
      {backlog.isFromCache && (
        <Text style={styles.text}>
          Показана сохранённая библиотека
          {backlog.updatedAt ? ` · ${formatDateTime(backlog.updatedAt)}` : ''}
        </Text>
      )}
      {backlog.errorMessage && (
        <BacklogErrorView
          code={backlog.errorCode ?? 'server'}
          message={backlog.errorMessage}
          onRetry={() => void backlog.refresh()}
          isRetrying={backlog.isRefreshing}
        />
      )}
      {backlog.games !== undefined && (
        <>
          {backlog.genresStatus === 'loading' && (
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              Загружаем жанры
              {remaining !== null && remaining !== undefined ? ` · осталось ${remaining}` : '…'}.
              Библиотека уже доступна.
            </Text>
          )}
          {unfinished && (
            <>
              <Text
                accessibilityRole={backlog.genresStatus === 'error' ? 'alert' : undefined}
                style={styles.text}
              >
                {backlog.genresStatus === 'error'
                  ? 'Не удалось загрузить метаданные.'
                  : 'Метаданные обработаны не полностью.'}
                {remaining !== null && remaining !== undefined
                  ? ` Осталось игр: ${remaining}.`
                  : ' Остаток пока неизвестен.'}{' '}
                Игры остаются в библиотеке.
              </Text>
              <Button
                label="Продолжить загрузку жанров"
                variant="secondary"
                disabled={backlog.isRefreshing}
                onPress={() => void backlog.retryGenres()}
              />
            </>
          )}
          {backlog.genresStatus === 'done' && unknown > 0 && (
            <Text style={styles.text}>
              Жанры не распознаны у {unknown} игр. Их можно исправить в карточке игры.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    text: { color: colors.textSecondary, fontSize: 13 },
  });
