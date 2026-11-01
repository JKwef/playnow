import { Button } from '@/shared/components/Button';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import type { RootStackScreenProps } from '@/navigation/types';

/** Результат подбора (FR4.3). Алгоритм на этапе 8. */
export function ResultScreen({ route, navigation }: RootStackScreenProps<'Result'>) {
  return (
    <Screen>
      <Placeholder title={`Контекст: ${route.params.contextId}`} stage={8} />
      <Button label="Играть" disabled />
      <Button label="Другой вариант" variant="secondary" disabled />
      <Button label="Отложить" variant="tertiary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
