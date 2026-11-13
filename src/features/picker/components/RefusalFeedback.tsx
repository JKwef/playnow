import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ChoiceInput } from '@/features/picker/services/acceptedChoice';
import { recommendationId } from '@/features/picker/services/recommendationHistory';
import { useRecommendationHistory } from '@/features/picker/hooks/useRecommendationHistory';
import { REFUSAL_LABELS, type RefusalReason } from '@/features/picker/types/refusal';
import { Button } from '@/shared/components/Button';
import { useThemeColors } from '@/shared/theme/useTheme';

/** Optional feedback about the previous result never controls picking the next game. */
export function RefusalFeedback({ input }: { input: ChoiceInput }) {
  const [expanded, setExpanded] = useState(false);
  const history = useRecommendationHistory();
  const colors = useThemeColors();
  const id = recommendationId(input);
  const entry = history.entries.find((item) => recommendationId(item) === id);
  const selected = entry?.refusal?.reason;
  const disabled = !history.isReady || history.isSaving || !entry;
  const text = { color: colors.textSecondary, fontSize: 14 };
  return (
    <View
      style={{ gap: 10, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}
    >
      <Text style={text}>Предыдущая рекомендация: «{input.game.name}».</Text>
      {selected && (
        <Text accessibilityLiveRegion="polite" style={text}>
          Последняя сохранённая причина: {REFUSAL_LABELS[selected]}.
        </Text>
      )}
      <Button
        label={expanded ? 'Скрыть причины отказа' : 'Указать причину (необязательно)'}
        variant="tertiary"
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <Text style={text}>
            Можно продолжить без ответа. Причина хранится в истории на этом устройстве. Статус игры
            и подбор не меняются.
          </Text>
          {!history.isReady && !history.error && <Text style={text}>Загружаем историю…</Text>}
          {history.isReady && !entry && (
            <Text style={text}>
              Рекомендации уже нет в истории. Продолжить подбор можно без причины.
            </Text>
          )}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`Причина отказа от ${input.game.name}`}
            style={{ gap: 8 }}
          >
            {(Object.keys(REFUSAL_LABELS) as RefusalReason[]).map((reason) => (
              <Button
                key={reason}
                label={`${selected === reason ? '● ' : '○ '}${REFUSAL_LABELS[reason]}`}
                accessibilityLabel={REFUSAL_LABELS[reason]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected === reason, disabled }}
                aria-checked={selected === reason}
                variant="secondary"
                disabled={disabled}
                onPress={() => void history.setRefusal(id, reason)}
              />
            ))}
          </View>
          {selected && (
            <Button
              label="Удалить причину отказа"
              variant="tertiary"
              disabled={disabled}
              onPress={() => void history.setRefusal(id, null)}
            />
          )}
          {history.error && (
            <>
              <Text accessibilityRole="alert" style={{ ...text, color: colors.error }}>
                {history.error}
              </Text>
              {!history.isReady && (
                <Button
                  label="Повторить загрузку истории"
                  variant="secondary"
                  onPress={() => void history.retry()}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
