import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/shared/constants';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** Если не задан, VoiceOver/TalkBack прочитают `label`. */
  accessibilityLabel?: string;
}

/**
 * Базовая кнопка дизайн-системы.
 * Высота от 48dp — минимальная зона нажатия по гайдлайнам iOS/Android.
 * Пары цветов текст/фон проходят WCAG AA: белый на #6200EE ≈ 7.6:1, чёрный на #03DAC6 ≈ 11:1.
 */
export function Button({
  label,
  variant = 'primary',
  disabled,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
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
      <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { fontSize: fontSize.body, fontWeight: '600' },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  tertiary: { backgroundColor: 'transparent' },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.textPrimary },
  secondary: { color: colors.background },
  tertiary: { color: colors.textSecondary },
});
