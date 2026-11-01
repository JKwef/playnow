import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/shared/constants';

/**
 * Временный корневой компонент. На этапе 2 здесь появится NavigationContainer
 * со стеком экранов.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        PlayNow
      </Text>
      <Text style={styles.subtitle}>Выбери игру за секунды</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.display,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
  },
});
