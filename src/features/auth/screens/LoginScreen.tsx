import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, spacing } from '@/shared/constants';
import { useAuth } from '@/shared/hooks/useAuth';

/** Экран приветствия (UI2). Вход через Steam OpenID появится на этапе 4. */
export function LoginScreen() {
  const signIn = useAuth((state) => state.signIn);

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
        // ЗАГЛУШКА ЭТАПА 2: фиктивный steamId, чтобы проверить переключение стеков.
        onPress={() => signIn('dev-steam-id')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.display, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.xs },
});
