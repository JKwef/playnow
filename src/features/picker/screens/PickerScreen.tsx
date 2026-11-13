import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { BacklogStatusNotice } from '@/features/backlog/components/BacklogStatusNotice';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { spacing } from '@/shared/constants';

import { ContextCard } from '../components/ContextCard';
import { useBlacklist } from '../hooks/useBlacklist';
import type { ContextId } from '../types';
import { PICKER_CONTEXTS } from '../utils/contexts';
import { matchesContext } from '../utils/pickGame';

export function PickerScreen({ navigation }: RootStackScreenProps<'Picker'>) {
  const styles = useThemedStyles(createStyles);

  const backlog = useBacklog();
  const { games, genresStatus, status } = backlog;
  const { postponed, isLoading: isBlacklistLoading } = useBlacklist();
  const [selection, setSelection] = useState<ContextId | null>(null);
  const counts = useMemo(
    () =>
      new Map(
        PICKER_CONTEXTS.map((context) => [
          context.id,
          (games ?? []).filter(
            (game) => !postponed.has(game.appid) && matchesContext(game, context),
          ).length,
        ]),
      ),
    [games, postponed],
  );
  const selected =
    selection ??
    PICKER_CONTEXTS.find((context) => (counts.get(context.id) ?? 0) > 0)?.id ??
    'short-session';
  const count = counts.get(selected) ?? 0;
  const loading = status === 'loading' || isBlacklistLoading;

  return (
    <Screen
      footer={
        <View style={styles.action}>
          <Button
            label={loading ? 'Загружаем игры…' : 'Подобрать игру  →'}
            disabled={loading || games === undefined || count === 0}
            onPress={() => navigation.navigate('Result', { contextId: selected })}
          />
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {status === 'error' && games === undefined
              ? 'Повтори загрузку библиотеки выше.'
              : loading
                ? 'Подбор станет доступен после загрузки.'
                : count > 0
                  ? 'Не попадём в настроение? Можно выбрать другой вариант.'
                  : genresStatus === 'loading'
                    ? 'Определяем жанры. Подходящие игры скоро появятся.'
                    : 'Пока нет подходящих игр. Попробуй другое настроение, верни отложенные игры или продолжи загрузку жанров.'}
          </Text>
        </View>
      }
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>ТВОЯ БИБЛИОТЕКА. ТВОЙ МОМЕНТ.</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Во что играем{'\n'}сегодня?
        </Text>
        <Text style={styles.subtitle}>Выбери настроение. Остальное — за Quaeso.</Text>
      </View>
      <View style={styles.libraryStatus}>
        <View style={styles.statusDot} />
        <Text style={styles.libraryText}>
          {games === undefined
            ? status === 'error'
              ? 'Библиотека недоступна'
              : 'Загружаем библиотеку…'
            : `${games.length} игр в библиотеке`}
        </Text>
        <Text style={styles.statusTag}>{genresStatus === 'loading' ? 'Жанры…' : 'STEAM'}</Text>
      </View>
      <BacklogStatusNotice backlog={backlog} />
      <Text style={styles.section}>Какой у тебя настрой?</Text>
      <View
        style={styles.grid}
        accessibilityRole="radiogroup"
        accessibilityLabel="Настроение для подбора"
      >
        {PICKER_CONTEXTS.map((context) => (
          <ContextCard
            key={context.id}
            context={context}
            matchingCount={counts.get(context.id) ?? 0}
            selected={selected === context.id}
            onPress={setSelection}
          />
        ))}
      </View>
      <View style={styles.shortcuts}>
        <View style={styles.shortcut}>
          <Button
            label="Библиотека"
            variant="secondary"
            onPress={() => navigation.navigate('Backlog')}
          />
        </View>
        <View style={styles.shortcut}>
          <Button
            label="Настройки"
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>
      {postponed.size > 0 && (
        <Button
          label={`Отложенные игры · ${postponed.size}`}
          variant="tertiary"
          onPress={() => navigation.navigate('Postponed')}
        />
      )}
      {games !== undefined && games.length === 0 && (
        <Button
          label="Добавить первую игру"
          variant="secondary"
          onPress={() => navigation.navigate('AddGame')}
        />
      )}
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    intro: { gap: 10, paddingTop: 8 },
    eyebrow: { color: colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
    title: {
      color: colors.textPrimary,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '800',
      letterSpacing: -1,
    },
    subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 23 },
    libraryStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary },
    libraryText: { flex: 1, color: colors.textSecondary, fontSize: 13 },
    statusTag: { color: colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    section: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    action: { gap: 10, marginTop: 4 },
    hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 },
    shortcut: { flex: 1, minWidth: 128 },
    notice: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
    noticeText: { color: colors.error, fontSize: 14 },
  });
