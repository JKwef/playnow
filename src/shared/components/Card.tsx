import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/shared/constants';

export interface CardProps {
  children: ReactNode;
  /** Если задан, карточка нажимается целиком и озвучивается как кнопка. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Общая поверхность Quaeso с тонкой границей. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CardProps) {
  const styles = useThemedStyles(createStyles);

  if (onPress === undefined) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.card,
      padding: spacing.xs,
      overflow: 'hidden',
    },
    pressed: { opacity: 0.85 },
  });
