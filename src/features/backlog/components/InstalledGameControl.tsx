import { Text, View } from 'react-native';
import { useInstalledGames } from '@/features/backlog/hooks/useInstalledGames';
import { Button } from '@/shared/components/Button';
import { useThemeColors } from '@/shared/theme/useTheme';

export function InstalledGameControl({ appid }: { appid: number }) {
  const installed = useInstalledGames();
  const colors = useThemeColors();
  const checked = installed.marked.has(appid);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.textSecondary }}>
        Ручная отметка для вашего игрового компьютера. Хранится на этом устройстве; Steam не
        проверяет установку. Отсутствие отметки не означает, что игра не установлена.
      </Text>
      <Button
        label={`${checked ? '✓ ' : '○ '}Установлено на моём игровом компьютере`}
        accessibilityLabel="Установлено на моём игровом компьютере"
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !installed.isReady || installed.isSaving }}
        aria-checked={checked}
        variant="secondary"
        disabled={!installed.isReady || installed.isSaving}
        onPress={() => void installed.setMarked(appid, !checked)}
      />
      {!installed.isReady && !installed.error && (
        <Text style={{ color: colors.textSecondary }}>Загружаем отметки установки…</Text>
      )}
      {installed.error && (
        <>
          <Text accessibilityRole="alert" style={{ color: colors.error }}>
            {installed.error}
          </Text>
          {!installed.isReady && (
            <Button
              label="Повторить загрузку отметок установки"
              variant="tertiary"
              onPress={() => void installed.retry()}
            />
          )}
        </>
      )}
    </View>
  );
}
