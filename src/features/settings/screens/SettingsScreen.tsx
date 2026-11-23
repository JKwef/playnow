import { useDesktopHeader } from '@/shared/hooks/useDesktopHeader';
import { DemoMenu } from '@/features/demo/screens/DemoMenu';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { Button } from '@/shared/components/Button';
import { BrandIntro } from '@/shared/components/BrandIntro';
import { Card } from '@/shared/components/Card';
import { Screen } from '@/shared/components/Screen';
import { ThemeSelector } from '@/shared/components/ThemeSelector';
import { fontSize, spacing } from '@/shared/constants';
import { formatDateTime } from '@/shared/utils/format';

import { SettingsRow } from '../components/SettingsRow';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useSignOut } from '../hooks/useSignOut';
import { readAppInfo } from '../utils/appInfo';
import { PickerSyncPanel } from '@/features/picker/components/PickerSyncPanel';

/** Настройки (FR6.1, UI2): обновить бэклог, выйти, удалить аккаунт, версия, политика. */
export function SettingsScreen() {
  const desktopHeader = useDesktopHeader();
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  const [intro, setIntro] = useState(false);

  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const backlog = useBacklog();
  const { requestSignOut, isSigningOut } = useSignOut();
  const { requestDeleteAccount, isDeleting, errorMessage: deleteError } = useDeleteAccount();
  const isAccountBusy = isSigningOut || isDeleting;
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
      <Text style={styles.secondary}>Меньше времени на выбор. Больше — на игру.</Text>
      <Text accessibilityRole="header" style={styles.section}>
        Оформление
      </Text>
      <Card style={styles.card}>
        <ThemeSelector />
        <Text style={styles.secondary}>Выбор сохраняется на этом устройстве.</Text>
      </Card>
      <Text accessibilityRole="header" style={styles.section}>
        Библиотека
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
          label={backlog.isRefreshing ? 'Обновляем…' : 'Обновить библиотеку'}
          variant="secondary"
          accessibilityHint="Заново загрузит список игр из Steam"
          disabled={backlog.isRefreshing}
          onPress={() => void backlog.refresh()}
        />
      </Card>

      <Text accessibilityRole="header" style={styles.section}>
        Аккаунт
      </Text>
      <PickerSyncPanel games={backlog.games} />
      {!desktopHeader && (
        <DemoMenu
          onSettings={() => navigation.navigate('AccountSettings')}
          onFavorites={() => navigation.navigate('Favorites')}
          onAcceptInvitation={(sessionId) => navigation.navigate('Demo', { sessionId })}
        />
      )}
      <Button
        label="Логин и пароль"
        variant="secondary"
        onPress={() => navigation.navigate('AccountSettings')}
      />
      <Card style={styles.card}>
        {steamId !== null ? <SettingsRow label="Steam ID" value={steamId} /> : null}
        <Button
          label={isSigningOut ? 'Выходим…' : 'Выйти из аккаунта'}
          variant="tertiary"
          disabled={isAccountBusy}
          onPress={() => void requestSignOut()}
        />
        <Button
          label={isDeleting ? 'Удаляем аккаунт…' : 'Удалить аккаунт'}
          variant="tertiary"
          labelStyle={styles.destructive}
          accessibilityHint="Навсегда удалит аккаунт и список игр на сервере и на этом устройстве"
          disabled={isAccountBusy}
          onPress={() => void requestDeleteAccount()}
        />
        <Text style={styles.secondary}>
          Удаление необратимо: аккаунт и список игр исчезнут навсегда.
        </Text>
        {deleteError !== null ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {deleteError}
          </Text>
        ) : null}
      </Card>

      <Text accessibilityRole="header" style={styles.section}>
        О приложении
      </Text>
      <Card style={styles.card}>
        <SettingsRow label="Версия" value={appInfo.version} />
        <Button
          label={intro ? 'Скрыть заставку' : 'Посмотреть заставку'}
          variant="tertiary"
          onPress={() => setIntro(!intro)}
        />
        {intro && <BrandIntro allowReplay />}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      color: colors.textSecondary,
      fontSize: fontSize.caption,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginTop: spacing.xs,
    },
    card: { gap: spacing.xs, padding: spacing.sm },
    text: { color: colors.textPrimary, fontSize: fontSize.body },
    secondary: { color: colors.textSecondary, fontSize: fontSize.caption + 2 },
    destructive: { color: colors.error },
    error: { color: colors.error, fontSize: fontSize.body },
  });
