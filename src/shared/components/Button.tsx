import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { fontSize, radius, spacing } from '@/shared/constants';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** Если не задан, VoiceOver/TalkBack прочитают `label`. */
  accessibilityLabel?: string;
  /** Дополнительный стиль подписи: например, красный текст у опасного действия. */
  labelStyle?: StyleProp<TextStyle>;
}

/**
 * Базовая кнопка дизайн-системы.
 * Высота от 48dp — минимальная зона нажатия по гайдлайнам iOS/Android.
 * Главное действие — мятная заливка, второстепенное — спокойная обводка.
 */
export function Button({
  label,
  variant = 'primary',
  disabled,
  accessibilityLabel,
  labelStyle,
  ...rest
}: ButtonProps) {
  const styles = useThemedStyles(createStyles);
  const variantStyles = useThemedStyles(createVariantStyles);
  const labelStyles = useThemedStyles(createLabelStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Text style={[styles.label, labelStyles[variant], labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.4 },
    label: { fontSize: fontSize.body, fontWeight: '700', textAlign: 'center' },
  });

const createVariantStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    tertiary: { backgroundColor: 'transparent' },
  });

const createLabelStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    primary: { color: colors.onPrimary },
    secondary: { color: colors.textPrimary },
    tertiary: { color: colors.textSecondary },
  });
