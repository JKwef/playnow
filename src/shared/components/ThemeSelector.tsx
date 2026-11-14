import { AppText as Text } from '@/shared/components/AppText';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { ThemeColors } from '@/shared/constants/colors';
import { isSpectrumMode, useTheme, useThemedStyles, type ThemeMode } from '@/shared/theme/useTheme';
import { supportsSpectrum } from '@/shared/theme/ThemeProvider';

const THEMES = {
  spectrum: { label: 'Тёмная палитра · ↑ / ↓', icon: '↑↓' },
  spectrumLight: { label: 'Светлая палитра · ↑ / ↓', icon: '↑↓' },
  dark: { label: 'Тёмная', icon: '☾' },
  light: { label: 'Светлая', icon: '☀' },
  glass: { label: 'Жидкое стекло', icon: '∿' },
  green: {
    label: 'Зелёная',
    icon: require('../../../assets/icons/sprout.png') as ImageSourcePropType,
  },
  burgundy: {
    label: 'Бордовая',
    icon: require('../../../assets/icons/flame.png') as ImageSourcePropType,
  },
} satisfies Record<ThemeMode, { label: string; icon: string | ImageSourcePropType }>;
const OPTIONS = (Object.keys(THEMES) as ThemeMode[]).map((value) => ({
  value,
  ...THEMES[value],
}));
const THEME_ORDER: readonly ThemeMode[] = [
  'dark',
  'light',
  'glass',
  'green',
  'burgundy',
  'spectrum',
  'spectrumLight',
];

function ThemeIcon({
  icon,
  color,
  size,
}: {
  icon: string | ImageSourcePropType;
  color: string;
  size: number;
}) {
  return typeof icon === 'string' ? (
    <Text accessible={false} style={{ color, fontSize: size }}>
      {icon}
    </Text>
  ) : (
    <Image
      accessible={false}
      source={icon}
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}

export function ThemeSelector({
  compact = false,
  onBrandPaper = false,
}: {
  compact?: boolean;
  onBrandPaper?: boolean;
}) {
  const { mode, colors, setMode, persistenceError } = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasSpectrum = supportsSpectrum();
  if (compact) {
    const order = THEME_ORDER.filter((value) => !isSpectrumMode(value) || hasSpectrum);
    const next = order[(order.indexOf(mode) + 1) % order.length] ?? 'dark';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Сменить тему. Сейчас: ${THEMES[mode].label}. Следующая: ${THEMES[next].label}`}
        onPress={() => void setMode(next)}
        style={[
          styles.toggle,
          onBrandPaper && { backgroundColor: colors.brandPaper, borderColor: '#486154' },
        ]}
      >
        <ThemeIcon
          icon={THEMES[mode].icon}
          color={onBrandPaper ? '#14281D' : colors.secondary}
          size={22}
        />
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
        {OPTIONS.filter(({ value }) => !isSpectrumMode(value) || hasSpectrum).map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: mode === option.value }}
            onPress={() => void setMode(option.value)}
            style={[styles.option, mode === option.value && styles.selected]}
          >
            <View style={styles.optionContent}>
              <ThemeIcon
                icon={option.icon}
                color={mode === option.value ? colors.secondary : colors.textSecondary}
                size={16}
              />
              <Text style={[styles.label, mode === option.value && styles.selectedLabel]}>
                {option.label}
              </Text>
            </View>
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
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      flexBasis: '46%',
      flexGrow: 1,
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.mintMuted, borderColor: colors.secondary },
    optionContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
    },
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
    error: { color: colors.error, fontSize: 13 },
  });
