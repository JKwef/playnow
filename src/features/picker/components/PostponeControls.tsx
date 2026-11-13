import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { spacing } from '@/shared/constants';
import type { ThemeColors } from '@/shared/constants/colors';
import { useThemedStyles } from '@/shared/theme/useTheme';

import { useBlacklist } from '../hooks/useBlacklist';
import type { PostponeDuration } from '../services/blacklist';
import { formatPostponedUntil } from '../utils/postponed';

export function PostponeControls({ appid }: { appid: number }) {
  const styles = useThemedStyles(createStyles);
  const state = useBlacklist();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const until = state.postponed.get(appid);
  const postpone = async (duration: PostponeDuration) => {
    setBusy(true);
    setError(null);
    try {
      await state.postpone(appid, duration);
      setMessage(duration === 'tomorrow' ? 'Игра отложена до завтра' : 'Игра отложена на неделю');
      setCanUndo(true);
    } catch {
      setError('Не удалось отложить игру. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await state.restore(appid);
      setCanUndo(false);
      setMessage('Временное откладывание снято');
    } catch {
      setError('Не удалось вернуть игру. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Отложить на этом устройстве — доступно без сети</Text>
      {until === undefined ? (
        <>
          <Button
            label="До завтра"
            variant="tertiary"
            disabled={busy || state.isLoading || !!state.errorMessage}
            onPress={() => void postpone('tomorrow')}
          />
          <Button
            label="На неделю"
            variant="tertiary"
            disabled={busy || state.isLoading || !!state.errorMessage}
            onPress={() => void postpone('week')}
          />
        </>
      ) : (
        <>
          <Text style={styles.text}>{formatPostponedUntil(until)}</Text>
          {!canUndo && (
            <Button
              label="Снять откладывание"
              variant="secondary"
              disabled={busy}
              onPress={() => void restore()}
            />
          )}
        </>
      )}
      {message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message}
        </Text>
      )}
      {(error || state.errorMessage) && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error ?? state.errorMessage}
        </Text>
      )}
      {state.errorMessage && (
        <Button
          label="Повторить загрузку отложенных"
          variant="secondary"
          onPress={() => void state.retry()}
        />
      )}
      {canUndo && (
        <Button
          label="Отменить откладывание"
          variant="secondary"
          disabled={busy}
          onPress={() => void restore()}
        />
      )}
    </View>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { gap: spacing.xs },
    text: { color: colors.textSecondary, fontSize: 13 },
    error: { color: colors.error, fontSize: 13 },
  });
