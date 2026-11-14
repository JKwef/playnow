import { useDesktopHeader } from '@/shared/hooks/useDesktopHeader';
import { DemoMenu } from '@/features/demo/screens/DemoMenu';
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
import { LastAcceptedChoice } from '../components/LastAcceptedChoice';
import { useBlacklist } from '../hooks/useBlacklist';
import { usePickerSelection } from '../hooks/usePickerSelection';
import { PICKER_MODE_LABELS, type PickerMode } from '../types';
import { PICKER_CONTEXTS } from '../utils/contexts';
import { filterCandidates } from '../utils/pickGame';
import { useInstalledGames } from '@/features/backlog/hooks/useInstalledGames';

export function PickerScreen({ navigation }: RootStackScreenProps<'Picker'>) {
  const desktopHeader = useDesktopHeader();
  const styles = useThemedStyles(createStyles);

  const backlog = useBacklog();
  const { games, genresStatus, status } = backlog;
  const blacklist = useBlacklist();
  const { postponed, isLoading: isBlacklistLoading } = blacklist;
  const preferences = useGamePreferences();
  const settings = usePickerSelection();
  const installed = useInstalledGames();
  const installedOnly = settings.selection.installedOnly === true;
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
            installedOnly,
            installedIds: installed.marked,
          }).length,
        ]),
      ),
    [games, postponed, preferences.preferences, mode, installedOnly, installed.marked],
  );
  const count = counts.get(selected) ?? 0;
  const loading =
    status === 'loading' ||
    isBlacklistLoading ||
    preferences.isLoading ||
    !settings.isReady ||
    (installedOnly && !installed.isReady && !installed.error);

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
              games === undefined ||
              (installedOnly && !installed.isReady)
            }
            onPress={() =>
              navigation.navigate('Result', {
                contextId: selected,
                mode,
                genreFilter: 'context',
                ...(installedOnly ? { installedOnly: true } : {}),
              })
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
        {!desktopHeader && (
          <DemoMenu
            onSettings={() => navigation.navigate('AccountSettings')}
            onFavorites={() => navigation.navigate('Demo', { favorites: true })}
            onAcceptInvitation={(sessionId) => navigation.navigate('Demo', { sessionId })}
          />
        )}
        <Text accessibilityRole="header" style={styles.title}>
          Во что играем?
        </Text>
      </View>
      <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel="Режим подбора">
        {(['new', 'continue'] as const).map((value: PickerMode) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            aria-checked={mode === value}
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
      <Text style={styles.section}>Какой у тебя настрой?</Text>
      <Button
        label={`${installedOnly ? '✓ ' : '○ '}Только отмеченные установленными`}
        accessibilityLabel="Только отмеченные установленными"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: installedOnly, disabled: !settings.isReady }}
        aria-checked={installedOnly}
        variant="secondary"
        disabled={!settings.isReady}
        onPress={() => settings.setInstalledOnly(!installedOnly)}
      />
      {installedOnly && (
        <Text style={styles.subtitle}>
          Только ваши ручные отметки для игрового компьютера, сохранённые на этом устройстве.
          Отметить игру можно в её карточке.
        </Text>
      )}
      {installedOnly && installed.error && (
        <Text accessibilityRole="alert" style={styles.noticeText}>
          {installed.error}
        </Text>
      )}
      {installedOnly && !installed.isReady && installed.error && (
        <Button
          label="Повторить загрузку отметок установки"
          variant="tertiary"
          onPress={() => void installed.retry()}
        />
      )}
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
      <LastAcceptedChoice
        games={games}
        canPickAnother={settings.isReady}
        onPickAnother={() =>
          navigation.navigate('Result', {
            contextId: selected,
            mode,
            genreFilter: 'context',
            ...(installedOnly ? { installedOnly: true } : {}),
          })
        }
      />
      <Button
        label="История рекомендаций"
        variant="secondary"
        onPress={() => navigation.navigate('RecommendationHistory')}
      />
      {postponed.size > 0 && (
        <Button
          label={`Отложенные игры · ${postponed.size}`}
          variant="tertiary"
          onPress={() => navigation.navigate('Postponed')}
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
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      lineHeight: 32,
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
    notice: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
    noticeText: { color: colors.error, fontSize: 14 },
  });
