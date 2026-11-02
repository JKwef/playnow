import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/shared/constants';

export interface SettingsRowProps {
  label: string;
  /** Значение справа (версия) или подсказка под названием. */
  value?: string;
  /** Если задан, строка нажимается и озвучивается как ссылка. */
  onPress?: () => void;
  accessibilityHint?: string;
}

/** Строка списка настроек (UI2: «Список опций»). */
export function SettingsRow({ label, value, onPress, accessibilityHint }: SettingsRowProps) {
  const content = (
    <>
      <Text style={[styles.label, onPress !== undefined && styles.link]}>{label}</Text>
      {value !== undefined ? <Text style={styles.value}>{value}</Text> : null}
    </>
  );
  if (onPress === undefined) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${label}: ${value ?? ''}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  label: { color: colors.textPrimary, fontSize: fontSize.body, flexShrink: 1 },
  link: { color: colors.secondary },
  value: { color: colors.textSecondary, fontSize: fontSize.body },
});
