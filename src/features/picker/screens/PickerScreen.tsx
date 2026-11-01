import { useCallback, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, spacing } from '@/shared/constants';

import { ContextCard } from '../components/ContextCard';
import { useBlacklist } from '../hooks/useBlacklist';
import type { ContextId } from '../types';
import { PICKER_CONTEXTS } from '../utils/contexts';
import { matchesContext } from '../utils/pickGame';

/** Главный экран Solo Mode (FR4.1, UI2): четыре карточки контекста сеткой 2×2. */
export function PickerScreen({ navigation }: RootStackScreenProps<'Picker'>) {
  const { games, genresStatus } = useBacklog();
  const { postponed } = useBlacklist();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Button
            label="Игры"
            variant="tertiary"
            accessibilityLabel="Мои игры"
            onPress={() => navigation.navigate('Backlog')}
          />
          <Button
            label="⚙"
            variant="tertiary"
            accessibilityLabel="Настройки"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      ),
    });
  }, [navigation]);

  const counts = useMemo(
    () =>
      new Map(
        PICKER_CONTEXTS.map((context) => [
          context.id,
          (games ?? []).filter((game) => matchesContext(game, context)).length,
        ]),
      ),
    [games],
  );

  const open = useCallback(
    (contextId: ContextId) => navigation.navigate('Result', { contextId }),
    [navigation],
  );

  const [first, second, third, fourth] = PICKER_CONTEXTS;

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Во что поиграть?
      </Text>
      <Text style={styles.subtitle}>
        {games === undefined
          ? 'Загружаем ваши игры…'
          : `Выберем из ${games.length} игр вашего бэклога`}
        {genresStatus === 'loading' ? '. Жанры ещё загружаются' : ''}
      </Text>
      {[
        [first, second],
        [third, fourth],
      ].map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((context) =>
            context === undefined ? null : (
              <ContextCard
                key={context.id}
                context={context}
                matchingCount={counts.get(context.id) ?? 0}
                onPress={open}
              />
            ),
          )}
        </View>
      ))}
      {postponed.size > 0 && (
        <Button
          label={`Отложенные игры: ${postponed.size}`}
          variant="tertiary"
          accessibilityHint="Откроет список отложенных игр, их можно вернуть в подбор"
          onPress={() => navigation.navigate('Postponed')}
        />
      )}
      {games !== undefined && games.length === 0 && (
        <Button label="Добавить игру вручную" onPress={() => navigation.navigate('AddGame')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.body },
  row: { flexDirection: 'row', gap: spacing.sm },
});
