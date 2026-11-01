import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { colors, fontSize, spacing } from '@/shared/constants';

import { PRIVATE_PROFILE_STEPS, STEAM_PRIVACY_SETTINGS_URL } from '../services/backlogErrors';
import type { BacklogErrorCode } from '../types/Game';

export interface BacklogErrorViewProps {
  code: BacklogErrorCode;
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}

/** Ошибка импорта. Для приватного профиля — пошаговая инструкция (FR2.7). */
export function BacklogErrorView({ code, message, onRetry, isRetrying }: BacklogErrorViewProps) {
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
    </View>
  );
}

const styles = StyleSheet.create({
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
