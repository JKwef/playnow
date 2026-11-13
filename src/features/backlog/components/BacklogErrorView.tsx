import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { fontSize, spacing } from '@/shared/constants';

import { PRIVATE_PROFILE_STEPS, STEAM_PRIVACY_SETTINGS_URL } from '../services/backlogErrors';
import type { BacklogErrorCode } from '../types/Game';

export interface BacklogErrorViewProps {
  code: BacklogErrorCode;
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
  /**
   * Выйти из аккаунта. Нужен, чтобы импорт, который не чинится повтором, не стал тупиком:
   * навигатор сам вернёт на экран входа.
   */
  onSignOut?: () => void;
  /**
   * Продолжить без импорта. Показывается, только если на устройстве уже есть игры
   * (кэш бэклога или добавленные вручную).
   */
  onContinue?: () => void;
}

/** Ошибка импорта. Для приватного профиля — пошаговая инструкция (FR2.7). */
export function BacklogErrorView({
  code,
  message,
  onRetry,
  isRetrying,
  onSignOut,
  onContinue,
}: BacklogErrorViewProps) {
  const styles = useThemedStyles(createStyles);

  const openPrivacySettings = () => {
    Linking.openURL(STEAM_PRIVACY_SETTINGS_URL).catch((error: unknown) => {
      console.warn('open Steam privacy settings failed', error);
    });
  };

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {message}
      </Text>
      {code === 'private_profile' && (
        <View style={styles.steps}>
          <Text style={styles.text}>Как открыть профиль:</Text>
          {PRIVATE_PROFILE_STEPS.map((step, index) => (
            <Text key={step} style={styles.text}>
              {index + 1}. {step}
            </Text>
          ))}
          <Button
            label="Открыть настройки приватности"
            variant="tertiary"
            accessibilityHint="Откроет настройки приватности Steam в браузере"
            onPress={openPrivacySettings}
          />
        </View>
      )}
      <Button
        label={isRetrying ? 'Загружаем…' : 'Повторить'}
        variant="secondary"
        disabled={isRetrying}
        onPress={onRetry}
      />
      {onContinue !== undefined && (
        <Button
          label="Продолжить без импорта"
          variant="secondary"
          accessibilityHint="Откроет подбор по уже сохранённым на устройстве играм"
          onPress={onContinue}
        />
      )}
      {onSignOut !== undefined && (
        <Button
          label="Выйти из аккаунта"
          variant="tertiary"
          accessibilityHint="Завершит сессию и вернёт на экран входа через Steam"
          onPress={onSignOut}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: spacing.sm },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.subtitle,
      fontWeight: '700',
      textAlign: 'center',
    },
    steps: { gap: spacing.xs },
    text: { color: colors.textSecondary, fontSize: fontSize.body },
  });
