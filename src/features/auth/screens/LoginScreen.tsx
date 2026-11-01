import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, spacing } from '@/shared/constants';
import { selectIsBusy, useAuth } from '@/shared/hooks/useAuth';

/** Экран приветствия (UI2). Вход через Steam OpenID появится на этапе 4. */
export function LoginScreen() {
  const signIn = useAuth((state) => state.signIn);
  const isBusy = useAuth(selectIsBusy);
  const error = useAuth((state) => state.error);

  return (
    <Screen withTopInset centered>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          PlayNow
        </Text>
        <Text style={styles.subtitle}>Выбери игру за секунды</Text>
      </View>
      <Button
        label="Войти через Steam"
        accessibilityHint="Откроет страницу входа Steam"
        disabled={isBusy}
        onPress={() => void signIn()}
      />
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.display, fontWeight: '700' },
  error: { color: colors.error, fontSize: fontSize.body, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.xs },
});
