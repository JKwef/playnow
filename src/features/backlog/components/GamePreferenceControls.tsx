import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { OptionsModal } from '@/shared/components/OptionsModal';
import { spacing } from '@/shared/constants';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';

import { useGamePreferences } from '../hooks/useGamePreferences';
import { DEFAULT_PREFERENCE, PROGRESS_LABELS, PROGRESS_STATUSES } from '../types/GamePreference';

export function GamePreferenceControls({ appid }: { appid: number }) {
  const styles = useThemedStyles(createStyles);
  const state = useGamePreferences();
  const preference = state.preferences.get(appid) ?? DEFAULT_PREFERENCE;
  const [selecting, setSelecting] = useState(false);
  const disabled = state.isSaving || !state.hasData;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Статус прохождения:{' '}
        {state.isLoading
          ? 'Загружаем…'
          : state.hasData
            ? PROGRESS_LABELS[preference.progressStatus]
            : 'Недоступен'}
      </Text>
      <Text style={styles.note}>
        Статус не определяется по времени Steam. Изменение статуса и постоянного исключения требует
        сети.
      </Text>
      {state.isFromCache && (
        <Text style={styles.note}>Показаны сохранённые статусы и исключения.</Text>
      )}
      {state.loadError && (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            {state.loadError}
          </Text>
          <Button
            label="Повторить загрузку статусов"
            variant="secondary"
            disabled={state.isRefreshing}
            onPress={() => void state.retry()}
          />
        </>
      )}
      <Button
        label="Изменить статус прохождения"
        variant="secondary"
        disabled={disabled}
        onPress={() => setSelecting(true)}
      />
      <OptionsModal
        visible={selecting}
        title="Статус прохождения"
        multiple={false}
        selected={[preference.progressStatus]}
        options={PROGRESS_STATUSES.map((value) => ({ value, label: PROGRESS_LABELS[value] }))}
        onToggle={(value) => {
          setSelecting(false);
          void state.save(appid, { progressStatus: value });
        }}
        onClose={() => setSelecting(false)}
      />
      {preference.progressStatus !== 'completed' && (
        <Button
          label="Пройдено"
          variant="tertiary"
          disabled={disabled}
          onPress={() => void state.save(appid, { progressStatus: 'completed' })}
        />
      )}
      {preference.excluded ? (
        <Text style={styles.note}>Постоянно исключена из подбора. Игра остаётся в библиотеке.</Text>
      ) : (
        <Button
          label="Не предлагать"
          variant="tertiary"
          disabled={disabled}
          onPress={() => void state.save(appid, { excluded: true })}
        />
      )}
      {(preference.excluded || preference.progressStatus === 'completed') && (
        <Button
          label="Вернуть в подбор"
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            void state.save(appid, {
              excluded: false,
              ...(preference.progressStatus === 'completed'
                ? { progressStatus: 'unspecified' }
                : {}),
            })
          }
        />
      )}
      <Text style={styles.note}>Если игра ещё отложена, срок откладывания действует отдельно.</Text>
      {state.message && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {state.message}
          {preference.excluded || preference.progressStatus === 'completed'
            ? '. Игра исключена из подбора.'
            : ''}
        </Text>
      )}
      {state.actionError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {state.actionError}
        </Text>
      )}
      {state.canUndo && (
        <Button
          label="Отменить"
          variant="secondary"
          disabled={state.isSaving}
          onPress={() => void state.undo()}
        />
      )}
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    label: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    note: { color: colors.textSecondary, fontSize: 13 },
    error: { color: colors.error, fontSize: 13 },
  });
