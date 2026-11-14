import { AppText as Text } from '@/shared/components/AppText';
import type { RootStackScreenProps } from '@/navigation/types';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { selectIsBusy, useAuth } from '@/features/auth/hooks/useAuth';
import { BrandIntro } from '@/shared/components/BrandIntro';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { ThemeSelector } from '@/shared/components/ThemeSelector';
import { fontSize, spacing } from '@/shared/constants';
import { AccountAuth } from './AccountAuth';

export function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const styles = useThemedStyles(createStyles);

  const signIn = useAuth((state) => state.signIn);
  const isBusy = useAuth(selectIsBusy);
  const error = useAuth((state) => state.error);
  const [accountAuth, setAccountAuth] = useState(false);

  return (
    <Screen withTopInset centered showBrandBar={false}>
      {accountAuth && <AccountAuth onClose={() => setAccountAuth(false)} />}
      <View style={styles.topline}>
        <View style={styles.dot} />
        <Text style={styles.eyebrow}>МЕНЬШЕ ВЫБОРА. БОЛЬШЕ ИГРЫ.</Text>
        <ThemeSelector compact />
      </View>
      <BrandIntro />
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          Твоя следующая{'\n'}любимая игра.
        </Text>
        <Text style={styles.subtitle}>
          Она уже может быть в твоей библиотеке. Подключи Steam — Quaeso поможет выбрать, во что
          сыграть сегодня.
        </Text>
      </View>
      <View style={styles.steps}>
        {['Подключи библиотеку', 'Выбери настроение', 'Найди свою игру'].map((label, index) => (
          <View key={label} style={styles.step}>
            <Text style={styles.number}>0{index + 1}</Text>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.trust}>
        Для импорта в Steam открой «Мой профиль» и «Игровая информация»: Профиль → Редактировать
        профиль → Настройки приватности. Сними флажок скрытия общего времени в играх. При закрытых
        данных мы покажем инструкцию и повтор импорта.
      </Text>
      <Button
        label="Попробовать без входа"
        variant="secondary"
        disabled={isBusy}
        onPress={() => navigation.navigate('Demo')}
      />
      <Button
        label={isBusy ? 'Открываем Steam…' : 'Продолжить со Steam  ↗'}
        accessibilityHint="Откроет защищённую страницу входа Steam"
        disabled={isBusy}
        onPress={() => void signIn()}
      />
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        label="Войти или зарегистрироваться"
        variant="tertiary"
        disabled={isBusy}
        onPress={() => setAccountAuth(true)}
      />
      <Text style={styles.trust}>Пароль остаётся в Steam. Нужна открытая библиотека игр.</Text>
    </Screen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    topline: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary },
    eyebrow: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      flex: 1,
    },
    hero: { gap: 12, marginVertical: 8 },
    title: {
      color: colors.textPrimary,
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -1,
      fontWeight: '800',
    },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.body, lineHeight: 25 },
    steps: { gap: 14, marginBottom: 12 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    number: { color: colors.secondary, fontSize: 12, fontWeight: '800', minWidth: 22 },
    stepLabel: { color: colors.textPrimary, fontSize: 14 },
    error: { color: colors.error, fontSize: fontSize.body, textAlign: 'center' },
    trust: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      paddingHorizontal: spacing.xs,
    },
  });
