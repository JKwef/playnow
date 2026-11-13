import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/theme/useTheme';
import { isManualAppId } from '@/features/backlog/utils/manualGame';
import { createSteamLauncher, isDesktopBrowser, steamStoreUrl } from '../services/steamLauncher';

/** Opening an external URL never changes the accepted choice or records a play session. */
export function SteamActions({ appid, label }: { appid: number; label?: string }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  if (isManualAppId(appid))
    return (
      <Text style={{ color: colors.textSecondary }}>
        Игра добавлена вручную без Steam appid. Выбор можно сохранить, но ссылки Steam у неё нет.
      </Text>
    );
  const desktop =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    isDesktopBrowser(navigator.userAgent);
  const action = async (kind: 'open' | 'page' | 'copy') => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'copy') {
        if (!(await Clipboard.setStringAsync(steamStoreUrl(appid)))) throw new Error('Copy failed');
        setMessage('Ссылка скопирована.');
      } else {
        await createSteamLauncher(Linking).launch(
          appid,
          kind === 'page' || !desktop ? 'mobile' : 'desktop',
        );
        setMessage('Ссылка передана системе. Фактический запуск игры не проверяется.');
      }
    } catch {
      setMessage(
        kind === 'copy'
          ? 'Не удалось скопировать ссылку. Можно выделить её ниже.'
          : 'Не удалось открыть ссылку. Попробуйте страницу Steam или скопируйте ссылку.',
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Button
        label={label ?? (desktop ? 'Открыть в Steam' : 'Открыть страницу Steam')}
        variant="secondary"
        disabled={busy}
        onPress={() => void action('open')}
      />
      {desktop && (
        <Button
          label="Страница Steam в браузере"
          variant="tertiary"
          disabled={busy}
          onPress={() => void action('page')}
        />
      )}
      <Button
        label="Скопировать ссылку"
        variant="tertiary"
        disabled={busy}
        onPress={() => void action('copy')}
      />
      <Text selectable style={{ color: colors.textSecondary }}>
        {steamStoreUrl(appid)}
      </Text>
      {message && (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
          {message}
        </Text>
      )}
    </View>
  );
}
