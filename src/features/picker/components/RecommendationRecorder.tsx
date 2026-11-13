import { useIsFocused } from '@react-navigation/native';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';
import { useRecommendationHistory } from '@/features/picker/hooks/useRecommendationHistory';
import { Button } from '@/shared/components/Button';
import { useThemeColors } from '@/shared/theme/useTheme';

/** Only a visible, ready result records a recommendation; demos and history never mount this. */
export function RecommendationRecorder({ input }: { input: ChoiceInput }) {
  const history = useRecommendationHistory();
  const focused = useIsFocused();
  const colors = useThemeColors();
  const { record, isReady } = history;
  const { appid, name } = input.game;
  const { mode, contextId, genreFilter, installedOnly } = input;
  useEffect(() => {
    if (focused)
      void record({
        game: { appid, name },
        mode,
        contextId,
        genreFilter,
        ...(installedOnly ? { installedOnly: true } : {}),
      });
  }, [focused, record, appid, name, mode, contextId, genreFilter, installedOnly]);
  if (!history.error) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="alert" style={{ color: colors.error }}>
        {history.error} Подбор и принятие выбора остаются доступны.
      </Text>
      <Button
        label="Повторить сохранение в историю"
        variant="tertiary"
        disabled={history.isSaving}
        onPress={() => {
          if (!isReady) void history.retry().then(() => record(input));
          else void record(input);
        }}
      />
    </View>
  );
}
