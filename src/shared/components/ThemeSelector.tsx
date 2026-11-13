import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ThemeColors } from '@/shared/constants/colors';
import { useTheme, useThemedStyles, type ThemeMode } from '@/shared/theme/useTheme';

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: '☾  Тёмная' },
  { mode: 'light', label: '☀  Светлая' },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, persistenceError } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        onPress={() => void setMode(mode === 'dark' ? 'light' : 'dark')}
        style={styles.toggle}
      >
        <Text style={styles.toggleIcon}>{mode === 'dark' ? '☀' : '☾'}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.container}>
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel="Оформление приложения"
      >
        {OPTIONS.map((option) => (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityLabel={option.mode === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
            accessibilityState={{ checked: mode === option.mode }}
            onPress={() => void setMode(option.mode)}
            style={[styles.option, mode === option.mode && styles.selected]}
          >
            <Text style={[styles.label, mode === option.mode && styles.selectedLabel]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {persistenceError !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {persistenceError}
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: 8 },
    row: { flexDirection: 'row', gap: 8 },
    option: {
      flex: 1,
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.mintMuted, borderColor: colors.secondary },
    label: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
    selectedLabel: { color: colors.secondary },
    toggle: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleIcon: { color: colors.secondary, fontSize: 22 },
    error: { color: colors.error, fontSize: 13 },
  });
