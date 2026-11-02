import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { Screen } from '@/shared/components/Screen';
import { colors, fontSize, spacing } from '@/shared/constants';
import { formatDateTime } from '@/shared/utils/format';

import { SettingsRow } from '../components/SettingsRow';
import { useSignOut } from '../hooks/useSignOut';
import { readAppInfo } from '../utils/appInfo';

/** Настройки (FR6.1, UI2): обновить бэклог, выйти, версия, политика конфиденциальности. */
export function SettingsScreen() {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const backlog = useBacklog();
  const { requestSignOut, isSigningOut } = useSignOut();
  const appInfo = useMemo(() => readAppInfo(Constants.expoConfig), []);

  const openPrivacyPolicy = useCallback(() => {
    const url = appInfo.privacyPolicyUrl;
    if (url === null) return;
    // Встроенный браузер: пользователь не уходит из приложения.
    WebBrowser.openBrowserAsync(url).catch((error: unknown) => {
      console.warn('in-app browser failed, opening system browser', error);
      Linking.openURL(url).catch((openError: unknown) => {
        console.warn('open privacy policy failed', openError);
      });
    });
  }, [appInfo.privacyPolicyUrl]);

  const backlogSummary =
    backlog.games === undefined
      ? 'Список игр ещё не загружен'
      : `Игр: ${backlog.games.length}` +
        (backlog.updatedAt !== null ? `. Обновлено ${formatDateTime(backlog.updatedAt)}` : '');

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.section}>
        Бэклог
      </Text>
      <Card style={styles.card}>
        <Text style={styles.text}>{backlogSummary}</Text>
        {backlog.genresStatus === 'loading' && backlog.genresRemaining !== null ? (
          <Text style={styles.secondary}>
            Загружаем жанры, осталось игр: {backlog.genresRemaining}
          </Text>
        ) : null}
        {/* Ошибку показываем только после попытки: кэш при этом остаётся на экране (NFR2.2). */}
        {backlog.errorMessage !== null && !backlog.isRefreshing ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {backlog.errorMessage}
          </Text>
        ) : null}
        <Button
          label={backlog.isRefreshing ? 'Обновляем…' : 'Обновить бэклог'}
          variant="secondary"
          accessibilityHint="Заново загрузит список игр из Steam"
          disabled={backlog.isRefreshing}
          onPress={() => void backlog.refresh()}
        />
      </Card>

      <Text accessibilityRole="header" style={styles.section}>
        Аккаунт
      </Text>
      <Card style={styles.card}>
        {steamId !== null ? <SettingsRow label="Steam ID" value={steamId} /> : null}
        <Button
          label={isSigningOut ? 'Выходим…' : 'Выйти из аккаунта'}
          variant="tertiary"
          disabled={isSigningOut}
          onPress={() => void requestSignOut()}
        />
      </Card>

      <Text accessibilityRole="header" style={styles.section}>
        О приложении
      </Text>
      <Card style={styles.card}>
        <SettingsRow label="Версия" value={appInfo.version} />
        {appInfo.privacyPolicyUrl !== null ? (
          <SettingsRow
            label="Политика конфиденциальности"
            accessibilityHint="Откроется в браузере"
            onPress={openPrivacyPolicy}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  card: { gap: spacing.xs, padding: spacing.sm },
  text: { color: colors.textPrimary, fontSize: fontSize.body },
  secondary: { color: colors.textSecondary, fontSize: fontSize.body },
  error: { color: colors.error, fontSize: fontSize.body },
});
