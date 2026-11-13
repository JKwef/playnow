import type { ThemeColors } from '@/shared/constants/colors';
import { useThemeColors, useThemedStyles } from '@/shared/theme/useTheme';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export interface LoadingIndicatorProps {
  /** Растянуть на весь экран и залить фоном приложения. */
  fullScreen?: boolean;
  /** Текст для скринридера. */
  label?: string;
}

export function LoadingIndicator({
  fullScreen = false,
  label = 'Загрузка',
}: LoadingIndicatorProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();

  return (
    <View
      style={fullScreen ? styles.fullScreen : styles.inline}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator size="large" color={colors.secondary} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fullScreen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inline: { alignItems: 'center', justifyContent: 'center' },
  });
