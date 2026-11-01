import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/shared/constants';

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

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { alignItems: 'center', justifyContent: 'center' },
});
