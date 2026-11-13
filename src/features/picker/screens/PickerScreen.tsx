import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { useGamePreferences } from '@/features/backlog/hooks/useGamePreferences';
import { BacklogStatusNotice } from '@/features/backlog/components/BacklogStatusNotice';
import type { RootStackScreenProps } from '@/navigation/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { spacing } from '@/shared/constants';

import { ContextCard } from '../components/ContextCard';
import { useBlacklist } from '../hooks/useBlacklist';
import { usePickerSelection } from '../hooks/usePickerSelection';
import { PICKER_MODE_LABELS, type PickerMode } from '../types';
import { PICKER_CONTEXTS } from '../utils/contexts';
import { filterCandidates } from '../utils/pickGame';

export function PickerScreen({ navigation }: RootStackScreenProps<'Picker'>) {
  const styles = useThemedStyles(createStyles);

  const backlog = useBacklog();
  const { games, genresStatus, status } = backlog;
  const blacklist = useBlacklist();
  const { postponed, isLoading: isBlacklistLoading } = blacklist;
  const preferences = useGamePreferences();
  const settings = usePickerSelection();
  const { mode, contextId: selected } = settings.selection;
  const counts = useMemo(
    () =>
      new Map(
        PICKER_CONTEXTS.map((context) => [
          context.id,
          filterCandidates(games ?? [], context, {
            exclude: new Set(postponed.keys()),
            preferences: preferences.preferences,
            mode,
          }).length,
        ]),
      ),
    [games, postponed, preferences.preferences, mode],
  );
  const count = counts.get(selected) ?? 0;
  const loading =
    status === 'loading' || isBlacklistLoading || preferences.isLoading || !settings.isReady;

  return (
    <Screen
      footer={
        <View style={styles.action}>
          <Button
            label={loading ? 'Загружаем игры…' : 'Подобрать игру  →'}
            disabled={
              loading ||
              preferences.isUnavailable ||
              !!blacklist.errorMessage ||
              games === undefined
            }
            onPress={() =>
              navigation.navigate('Result', { contextId: selected, mode, genreFilter: 'context' })
            }
          />
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {status === 'error' && games === undefined
              ? 'Повтори загрузку библиотеки выше.'
              : preferences.isUnavailable || blacklist.errorMessage
                ? 'Повтори загрузку статусов и отложенных игр выше.'
                : loading
                  ? 'Подбор станет доступен после загрузки.'
                  : count > 0
                    ? 'Не попадём в настроение? Можно выбрать другой вариант.'
                    : genresStatus === 'loading'
                      ? 'Определяем жанры. Подходящие игры скоро появятся.'
                      : 'Под выбранные условия пока нет игр. Открой результат, чтобы увидеть причины и доступные действия.'}
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
      <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel="Режим подбора">
        {(['new', 'continue'] as const).map((value: PickerMode) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === value, disabled: !settings.isReady }}
            accessibilityLabel={PICKER_MODE_LABELS[value]}
            disabled={!settings.isReady}
            onPress={() => settings.setMode(value)}
            style={[styles.mode, mode === value && styles.modeSelected]}
          >
            <Text style={styles.modeText}>
              {mode === value ? '● ' : '○ '}
              {PICKER_MODE_LABELS[value]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.subtitle}>
        {mode === 'new'
          ? 'Сначала отмеченные «Не начинал», затем игры без статуса с нулевым временем.'
          : 'Сначала отмеченные «Играю», затем игры без статуса с ненулевым временем.'}
      </Text>
      {settings.error && (
        <Text accessibilityRole="alert" style={styles.noticeText}>
          {settings.error}
        </Text>
      )}
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
      {blacklist.errorMessage && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.noticeText}>
            {blacklist.errorMessage}
          </Text>
          <Button
            label="Повторить загрузку отложенных"
            variant="secondary"
            onPress={() => void blacklist.retry()}
          />
        </View>
      )}
      {preferences.isFromCache && (
        <Text style={styles.subtitle}>Используются сохранённые статусы и исключения.</Text>
      )}
      {preferences.loadError && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.noticeText}>
            {preferences.loadError}
          </Text>
          <Button
            label="Повторить загрузку статусов"
            variant="secondary"
            disabled={preferences.isRefreshing}
            onPress={() => void preferences.retry()}
          />
        </View>
      )}
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
            onPress={settings.setContext}
            disabled={!settings.isReady}
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
    modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    mode: {
      flexGrow: 1,
      minHeight: 48,
      justifyContent: 'center',
      padding: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeSelected: { borderColor: colors.secondary, backgroundColor: colors.mintMuted },
    modeText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
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
