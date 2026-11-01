import { Button } from '@/shared/components/Button';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import type { RootStackScreenProps } from '@/navigation/types';

/** Список игр (FR3). FlatList, поиск и фильтры на этапе 7. */
export function BacklogScreen({ navigation }: RootStackScreenProps<'Backlog'>) {
  return (
    <Screen>
      <Placeholder title="Мои игры" stage={7} />
      <Button
        label="Открыть игру (пример)"
        variant="secondary"
        onPress={() => navigation.navigate('GameDetails', { appid: 730 })}
      />
    </Screen>
  );
}
